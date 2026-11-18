import test from 'node:test';
import assert from 'node:assert/strict';
import {applyCommand,emptyState,seedProducts,orderQuote,report} from './domain.js';
import {effectiveProduct,customerHistory,stalledProducts,purchaseSummary,businessDay} from './commerce.js';

const now = new Date('2026-11-18T16:00:00Z');
const command = (type,data) => ({id:crypto.randomUUID(),type,data});
const run = (state,type,data,date = now) => applyCommand(state,command(type,data),{now:date,actor:'Operador teste'});
function state() {const value = emptyState();value.products = seedProducts();return value;}
function supplier(s) {return run(s,'suppliers.save',{name:'Fornecedor teste',active:true});}
function purchase(s,extra = {}) {const product = s.products[0];return {supplierId:s.suppliers[0].id,items:[{productId:product.id,variantId:product.variants[0].id,qty:3,unitCost:6000}],date:'2026-11-18',dueDate:'2026-11-25',...extra};}
function sale(s,extra = {}) {return {items:[{productId:s.products[0].id,variantId:s.products[0].variants[0].id,qty:1}],customer:{name:'Cliente teste'},...extra};}

test('dados anteriores recebem novos campos sem perder catálogo ou vendas', () => {
  const s = state();for (const key of ['promotions','suppliers','purchases','campaigns','banners']) delete s[key];
  const next = supplier(s);
  for (const key of ['promotions','suppliers','purchases','campaigns','banners']) assert.ok(Array.isArray(next[key]));
  assert.equal(next.products.length,s.products.length);assert.equal(s.suppliers,undefined);
});

test('promoção vigente usa menor preço uma vez e servidor preserva preço bruto e custo histórico', () => {
  let s = state();const id = s.products[0].id;
  s = run(s,'promotions.save',{name:'Drop 20',productIds:[id],kind:'percent',value:20,start:'2026-11-18',end:'2026-11-18',active:true});
  s = run(s,'promotions.save',{name:'Menor desconto',productIds:[id],kind:'fixed',value:100,start:'',end:'',active:true});
  const discounted = effectiveProduct(s.products[0],s.promotions,now);
  assert.equal(discounted.price,7192);assert.equal(discounted.originalPrice,8990);assert.equal(discounted.promotionName,'Drop 20');
  assert.deepEqual(effectiveProduct(discounted,s.promotions,now),discounted);
  assert.equal(effectiveProduct(discounted,[],now).price,8990);
  assert.equal(s.products[0].price,8990);assert.equal(orderQuote(s,sale(s),now).total,7192);
  const withSale = run(s,'orders.create',sale(s,{paid:true}));
  const after = run(withSale,'promotions.archive',{id:s.promotions.find(p => p.name === 'Drop 20').id});
  assert.equal(after.orders[0].items[0].unitPrice,7192);assert.equal(after.orders[0].items[0].unitCost,s.products[0].cost);
  assert.equal(orderQuote(after,sale(after),now).total,8890);
});

test('vigência segue o dia de Manaus e datas impossíveis ou intervalos invertidos são rejeitados', () => {
  const s = state();const data = {name:'Teste',productIds:[s.products[0].id],kind:'percent',value:10,start:'2026-11-18',end:'2026-11-19',active:true};
  assert.equal(businessDay(new Date('2026-11-18T02:00:00Z')),'2026-11-17');
  const next = run(s,'promotions.save',data);
  assert.equal(effectiveProduct(s.products[0],next.promotions,new Date('2026-11-18T02:00:00Z')).price,8990);
  assert.throws(() => run(s,'promotions.save',{...data,start:'2026-02-30'}),/válida/);
  assert.throws(() => run(s,'promotions.save',{...data,end:'2026-11-17'}),/final/);
  assert.throws(() => run(s,'promotions.save',{...data,value:101}),/Desconto/);
});

test('recebimento soma estoque e custo médio, não duplica ao repetir e não transforma compra em despesa', () => {
  let s = supplier(state());const stockBefore = s.products[0].variants.reduce((n,v) => n+v.stock,0);const costBefore = s.products[0].cost;
  s = run(s,'purchases.save',purchase(s));
  const purchaseId = s.purchases[0].id;assert.equal(s.products[0].variants[0].stock,2);assert.equal(purchaseSummary(s,now).pendingTotal,18000);
  const cmd = command('purchases.receive',{id:purchaseId});
  s = applyCommand(s,cmd,{now});
  assert.equal(s.products[0].variants[0].stock,5);
  assert.equal(s.products[0].cost,Math.round((stockBefore*costBefore+18000)/(stockBefore+3)));
  const again = run(s,'purchases.receive',{id:purchaseId});assert.equal(again.products[0].variants[0].stock,5);assert.equal(again.movements.length,s.movements.length);
  assert.equal(applyCommand(s,cmd,{now}),s);assert.equal(s.expenses.length,0);assert.equal(report(s).expenses,0);
  assert.equal(s.purchases[0].status,'received');assert.equal(s.movements[0].delta,3);
});

test('recebimento inteiro é rejeitado sem alterar saldo quando uma linha supera o limite', () => {
  let s = supplier(state());s.products[0].variants[1].stock = 100000;
  const product = s.products[0];
  s = run(s,'purchases.save',purchase(s,{items:[{productId:product.id,variantId:product.variants[0].id,qty:1,unitCost:100},{productId:product.id,variantId:product.variants[1].id,qty:1,unitCost:100}]}));
  const before = structuredClone(s);
  assert.throws(() => run(s,'purchases.receive',{id:s.purchases[0].id}),/Saldo/);
  assert.deepEqual(s,before);
});

test('compra pré-paga em aberto protege variação sem saldo contra remoção e troca de tamanho ou cor', () => {
  let s = supplier(state());s.products[0].variants[0].stock = 0;
  s = run(s,'purchases.save',purchase(s));
  s = run(s,'purchases.pay',{id:s.purchases[0].id});
  const product = structuredClone(s.products[0]);const original = structuredClone(s);
  assert.equal(s.purchases[0].status,'ordered');assert.equal(s.purchases[0].payment,'paid');
  assert.throws(() => run(s,'products.save',{...product,variants:product.variants.slice(1)}),/compra em aberto/);
  for (const modification of [{size:'EXTRA'},{color:'Verde'}]) {
    const variants = product.variants.map((variant,index) => index === 0 ? {...variant,...modification} : variant);
    assert.throws(() => run(s,'products.save',{...product,variants}),/compra em aberto/);
  }
  assert.deepEqual(s,original);
  assert.throws(() => run(s,'purchases.cancel',{id:s.purchases[0].id}),/não pagas/);
});

test('recebimento protege estoque e novo custo contra formulário aberto antes da reposição', () => {
  let s = supplier(state());s.products[0].updatedAt = now.toISOString();
  const original = structuredClone(s.products[0]);
  s = run(s,'purchases.save',purchase(s));s = run(s,'purchases.pay',{id:s.purchases[0].id});
  // Same millisecond intentionally: the stock comparison must still detect a stale form.
  s = run(s,'purchases.receive',{id:s.purchases[0].id},now);
  assert.equal(s.products[0].updatedAt,original.updatedAt);
  assert.notEqual(s.products[0].cost,original.cost);
  assert.throws(() => run(s,'products.save',{...original,expectedUpdatedAt:original.updatedAt,expectedStock:original.variants.map(v => ({id:v.id,stock:v.stock}))}),/estoque mudou/);
  assert.equal(s.products[0].variants[0].stock,5);
});

test('PDV combina promoção e cupom sobre preço real e congela custo recebido sem alterar vendas antigas', () => {
  let s = supplier(state());const firstCost = s.products[0].cost;
  s = run(s,'orders.create',sale(s,{paid:true}));const originalOrderId = s.orders[0].id;
  s = run(s,'purchases.save',purchase(s));s = run(s,'purchases.receive',{id:s.purchases[0].id});
  const receivedCost = s.products[0].cost;assert.notEqual(receivedCost,firstCost);
  s = run(s,'promotions.save',{name:'Drop 20',productIds:[s.products[0].id],kind:'percent',value:20,start:'2026-11-18',end:'2026-11-18',active:true});
  s = run(s,'coupons.save',{code:'LOCAL10',type:'percent',value:10,minimum:0,expires:'',active:true,limit:0});
  const input = sale(s,{reference:crypto.randomUUID(),coupon:'LOCAL10',shipping:0,expectedTotal:6473,method:'cash',receivedAmount:10000,confirmReceived:true});
  s = run(s,'pos.checkout',input);
  const posOrder = s.orders[0];
  assert.equal(posOrder.status,'delivered');assert.equal(posOrder.payment,'paid');
  assert.equal(posOrder.items[0].unitPrice,7192);assert.equal(posOrder.subtotal,7192);assert.equal(posOrder.discount,719);assert.equal(posOrder.total,6473);
  assert.equal(posOrder.change,3527);assert.equal(posOrder.items[0].unitCost,receivedCost);assert.equal(s.products[0].price,8990);
  s = run(s,'purchases.save',purchase(s,{items:[{...purchase(s).items[0],unitCost:10000}]}));
  s = run(s,'purchases.receive',{id:s.purchases[0].id});
  assert.notEqual(s.products[0].cost,receivedCost);
  assert.equal(s.orders.find(order => order.id === posOrder.id).items[0].unitCost,receivedCost);
  assert.equal(s.orders.find(order => order.id === originalOrderId).items[0].unitCost,firstCost);
});

test('contas a pagar tratam vencimento, cancelamento e registro de pagamento sem cobrar ou duplicar despesa', () => {
  let s = supplier(state());s = run(s,'purchases.save',purchase(s,{date:'2026-11-01',dueDate:'2026-11-10'}));
  assert.equal(purchaseSummary(s,now).overdueTotal,18000);
  const id = s.purchases[0].id;s = run(s,'purchases.pay',{id});
  assert.equal(s.purchases[0].payment,'paid');assert.equal(purchaseSummary(s,now).pendingTotal,0);assert.equal(purchaseSummary(s,now).paidTotal,18000);
  assert.throws(() => run(s,'purchases.cancel',{id}),/não pagas/);
  assert.equal(run(s,'purchases.pay',{id}).expenses.length,0);
  s = run(s,'purchases.save',purchase(s,{dueDate:''}));
  assert.equal(s.purchases[0].dueDate,'');assert.equal(purchaseSummary(s,now).overdueCount,0);
  const cancelId = s.purchases[0].id;s = run(s,'purchases.cancel',{id:cancelId});
  assert.equal(purchaseSummary(s,now).pendingTotal,0);assert.throws(() => run(s,'purchases.receive',{id:cancelId}),/aberto/);assert.throws(() => run(s,'purchases.pay',{id:cancelId}),/cancelada/);
});

test('histórico de cliente usa identificador, preserva pedidos e exclui estornos da receita', () => {
  let s = state();s = run(s,'customers.save',{name:'Mesmo nome',email:'a@example.com'});const id = s.customers[0].id;
  s = run(s,'orders.create',sale(s,{customerId:id,paid:true}));
  s = run(s,'orders.create',sale(s,{customer:{name:'Mesmo nome',email:'a@example.com'},paid:true}));
  const history = customerHistory(s,id);assert.equal(history.orders.length,1);assert.equal(history.totalSpent,8990);assert.deepEqual(history.sizes,[{size:'P',qty:1}]);
  s = run(s,'orders.refund',{id:history.orders[0].id,reason:'Teste',restock:true});
  const after = customerHistory(s,id);assert.equal(after.orders.length,1);assert.equal(after.totalSpent,0);assert.equal(after.paidCount,0);
});

test('peças paradas não incluem novidades, estoque zero ou venda recente e consideram reposição sem venda', () => {
  const s = state();for (const p of s.products) p.createdAt = '2026-10-01T12:00:00Z';
  s.products[1].createdAt = '2026-11-15T12:00:00Z';
  s.products[2].variants.forEach(v => {v.stock = 0;});
  s.orders = [{id:'recent',payment:'paid',status:'delivered',createdAt:'2026-11-10T12:00:00Z',paidAt:'2026-11-10T12:00:00Z',items:[{productId:s.products[3].id,qty:1}]}];
  s.movements = [{productId:s.products[4].id,delta:5,at:'2026-11-17T12:00:00Z'}];
  const rows = stalledProducts(s,30,now);
  assert.ok(rows.some(p => p.id === s.products[0].id));assert.ok(rows.every(p => p.daysIdle >= 30));
  for (const index of [1,2,3,4]) assert.ok(!rows.some(p => p.id === s.products[index].id));
});

test('banners validam destino, imagem e limite; marketing só armazena planejamento', () => {
  let s = state();const banner = {title:'Novo drop',subtitle:'Estilo da rua',eyebrow:'GRIFF',buttonText:'Ver coleção',target:'catalog',image:'images/hero.jpg',active:true,position:0};
  for (let i = 0;i < 5;i++) s = run(s,'banners.save',{...banner,title:`Drop ${i}`});
  assert.throws(() => run(s,'banners.save',banner),/5 banners/);
  assert.throws(() => run(s,'banners.save',{...banner,active:false,image:'javascript:alert(1)'}),/Imagem/);
  assert.throws(() => run(s,'banners.save',{...banner,active:false,target:'https://evil.example'}),/Destino/);
  s = run(s,'banners.archive',{id:s.banners[0].id});
  s = run(s,'campaigns.save',{name:'Drop sexta',channel:'WhatsApp',status:'planned',date:'2026-11-20',productIds:[s.products[0].id],message:'Confira o próximo drop.'});
  assert.equal(s.campaigns.length,1);assert.equal(s.campaigns[0].status,'planned');assert.equal(s.orders.length,0);
});
