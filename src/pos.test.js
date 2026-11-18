import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCommand, emptyState, report, seedProducts } from './domain.js';
import { changePosQuantity, posPayment, posProducts, posQuote } from './pos.js';

function state() {const value = emptyState();value.products = seedProducts();return value;}
function payload(s, extra = {}) {return {reference:crypto.randomUUID(),items:[{productId:s.products[0].id,variantId:s.products[0].variants[0].id,qty:1}],customer:{name:'Cliente balcão'},shipping:0,expectedTotal:8990,method:'cash',receivedAmount:10000,confirmReceived:true,...extra};}
const command = data => ({id:crypto.randomUUID(),type:'pos.checkout',data});

test('PDV conclui recebimento e entrega em uma operação, calcula troco e atualiza relatório e estoque', () => {
  const original = state();
  const next = applyCommand(original,command(payload(original)));
  const order = next.orders[0];
  assert.equal(order.channel,'presencial');assert.equal(order.status,'delivered');assert.equal(order.payment,'paid');
  assert.equal(order.receivedAmount,10000);assert.equal(order.change,1010);assert.equal(order.total,8990);
  assert.equal(next.products[0].variants[0].stock,1);assert.equal(original.products[0].variants[0].stock,2);
  assert.equal(report(next).revenue,8990);assert.equal(report(next).pending.length,0);
  assert.equal(next.customers.length,0);
});

test('PDV rejeita confirmação ausente, dinheiro insuficiente, total alterado e frete sem qualquer baixa', () => {
  const s = state();
  for (const extra of [{confirmReceived:false},{receivedAmount:8989},{expectedTotal:1},{shipping:200},{method:'invalid'},{reference:''}]) {
    assert.throws(() => applyCommand(s,command(payload(s,extra))));
    assert.equal(s.orders.length,0);assert.equal(s.products[0].variants[0].stock,2);
  }
});

test('referência da venda impede duplicidade inclusive após reconexão com novo comando', () => {
  let s = state();const sale = payload(s);const cmd = command(sale);
  s = applyCommand(s,cmd);
  assert.equal(applyCommand(s,cmd),s);
  const repeated = applyCommand(s,command(sale));
  assert.equal(repeated,s);assert.equal(repeated.orders.length,1);assert.equal(repeated.products[0].variants[0].stock,1);
});

test('venda presencial impede excesso de estoque e aceita estorno manual com reposição uma vez', () => {
  let s = state();const input = payload(s);input.items[0].qty = 3;input.expectedTotal = 26970;input.receivedAmount = 30000;
  assert.throws(() => applyCommand(s,command(input)),/Estoque insuficiente/);
  s = applyCommand(s,command(payload(s,{method:'pix',receivedAmount:999999})));
  assert.equal(s.orders[0].receivedAmount,8990);assert.equal(s.orders[0].change,0);
  s = applyCommand(s,{id:crypto.randomUUID(),type:'orders.refund',data:{id:s.orders[0].id,reason:'Devolução no balcão',restock:true}});
  assert.equal(s.orders[0].status,'returned');assert.equal(s.products[0].variants[0].stock,2);assert.equal(report(s).revenue,0);
  assert.throws(() => applyCommand(s,{id:crypto.randomUUID(),type:'orders.refund',data:{id:s.orders[0].id,reason:'Repetido',restock:true}}));
});

test('sacola do PDV mantém tamanhos separados, busca SKU de variação e respeita saldo', () => {
  const s = state();const p = s.products[0];let items = [];
  items = changePosQuantity(s,items,p.id,p.variants[0].id,1);
  items = changePosQuantity(s,items,p.id,p.variants[1].id,1);
  items = changePosQuantity(s,items,p.id,p.variants[0].id,1);
  assert.equal(items.length,2);assert.equal(items[0].qty,2);assert.equal(posQuote(s,items).total,26970);
  assert.throws(() => changePosQuantity(s,items,p.id,p.variants[0].id,1),/estoque/);
  assert.equal(posProducts(s,p.variants[0].sku)[0].id,p.id);
  assert.equal(posProducts(s,'calca')[0].id,'cargo');
  assert.equal(changePosQuantity(s,items,p.id,p.variants[1].id,-1).length,1);
});

test('PDV aplica cupom do catálogo e calcula recebimento em centavos sem aceitar dinheiro inválido', () => {
  const s = state();s.coupons = [{id:'coupon',code:'LOJA10',type:'percent',value:10,minimum:0,expires:'',active:true,limit:0}];
  const data = payload(s,{coupon:'LOJA10',expectedTotal:8091});
  const quote = posQuote(s,data.items,'LOJA10');
  assert.equal(quote.discount,899);assert.equal(posPayment(quote,'cash','100,00').change,1909);
  assert.ok(posPayment(quote,'cash','80,00').error);assert.ok(posPayment(quote,'cash','abc').error);
  const next = applyCommand(s,command(data));assert.equal(next.orders[0].total,8091);assert.equal(next.orders[0].change,1909);
  assert.throws(() => posQuote(s,data.items,'INEXISTENTE'));
});
