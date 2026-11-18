import { BusinessError } from './errors.js';

const fail = message => { throw new BusinessError(message); };
const clean = (value, max = 200) => String(value ?? '').trim().slice(0,max);
const text = (value, label, max = 200) => clean(value,max) || fail(`Informe ${label}.`);
const integer = (value, label, min = 0, max = 100000000) => Number.isSafeInteger(value) && value >= min && value <= max ? value : fail(`${label}: valor inválido.`);
const arrays = ['promotions','suppliers','purchases','campaigns','banners'];
const dayFormatter = new Intl.DateTimeFormat('en-US',{timeZone:'America/Manaus',year:'numeric',month:'2-digit',day:'2-digit'});

export function ensureCommerceState(state) {
  for (const key of arrays) if (!Array.isArray(state[key])) state[key] = [];
  return state;
}

export function businessDay(value = new Date()) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = dayFormatter.formatToParts(date);
  const part = type => parts.find(p => p.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function dateValue(value, label, optional = true) {
  if (!value && optional) return '';
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(`Informe ${label} válida.`);
  const parsed = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0,10) !== value) fail(`Informe ${label} válida.`);
  return value;
}

function productIds(state, value, required = false) {
  if (!Array.isArray(value) || value.length > 1000) fail('Selecione os produtos da ação.');
  const ids = [...new Set(value)];
  if (required && !ids.length) fail('Selecione pelo menos uma roupa.');
  if (ids.some(id => typeof id !== 'string' || !state.products.some(p => p.id === id))) fail('Uma das roupas selecionadas não existe mais.');
  return ids;
}

function existingRecord(list, id, label) {
  if (!id) return null;
  return list.find(item => item.id === id) || fail(`${label} não encontrado. Atualize a tela.`);
}

export function activePromotions(state, now = new Date()) {
  const day = businessDay(now);
  return (state.promotions || []).filter(p => p.active === true && (!p.start || p.start <= day) && (!p.end || p.end >= day));
}

export function effectiveProduct(product, promotions = [], now = new Date()) {
  const day = businessDay(now);
  const base = {...product};
  if (product.promotionId && Number.isSafeInteger(product.originalPrice) && product.originalPrice > 0) base.price = product.originalPrice;
  delete base.originalPrice;delete base.promotionId;delete base.promotionName;
  let price = base.price;
  let winner = null;
  for (const promotion of promotions) {
    if (promotion.active !== true || !promotion.productIds?.includes(product.id) || promotion.start && promotion.start > day || promotion.end && promotion.end < day) continue;
    if (!Number.isInteger(promotion.value) || promotion.value < 1 || !['percent','fixed'].includes(promotion.kind)) continue;
    if (promotion.kind === 'percent' && promotion.value > 100) continue;
    const reduction = promotion.kind === 'percent' ? Math.round(base.price*promotion.value/100) : promotion.value;
    const candidate = Math.max(1,base.price-reduction);
    if (candidate < price) {price = candidate;winner = promotion;}
  }
  return winner ? {...base,price,originalPrice:base.price,promotionId:winner.id,promotionName:winner.name} : base;
}

export function customerHistory(state, customerId) {
  const customer = state.customers.find(c => c.id === customerId) || null;
  const orders = customer ? state.orders.filter(order => order.customer?.id === customerId).sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt))) : [];
  const paidOrders = orders.filter(order => order.payment === 'paid' && !['canceled','returned'].includes(order.status));
  const totalSpent = paidOrders.reduce((sum,order) => sum+order.total,0);
  const sizes = new Map();
  for (const order of paidOrders) for (const item of order.items) sizes.set(item.size,(sizes.get(item.size) || 0)+item.qty);
  const dates = paidOrders.map(order => order.paidAt || order.createdAt).sort().reverse();
  return {customer,orders,paidOrders,orderCount:orders.length,paidCount:paidOrders.length,totalSpent,average:paidOrders.length ? Math.round(totalSpent/paidOrders.length) : 0,lastPurchase:dates[0] || null,sizes:[...sizes].map(([size,qty]) => ({size,qty})).sort((a,b) => b.qty-a.qty)};
}

export function stalledProducts(state, days = 30, now = new Date()) {
  const threshold = Number.isFinite(Number(days)) && Number(days) >= 1 ? Math.floor(Number(days)) : 30;
  const midnight = date => Date.parse(`${businessDay(date)}T00:00:00Z`);
  const today = midnight(now);
  const paid = state.orders.filter(order => order.payment === 'paid' && !['canceled','returned'].includes(order.status));
  const saleDates = new Map();const restocks = new Map();
  for (const order of paid) {
    const at = order.paidAt || order.createdAt;const stamp = midnight(at);
    if (!Number.isFinite(stamp)) continue;
    for (const item of order.items) if (!saleDates.has(item.productId) || saleDates.get(item.productId).stamp < stamp) saleDates.set(item.productId,{at,stamp});
  }
  for (const movement of state.movements || []) {
    if (movement.delta <= 0) continue;
    const stamp = midnight(movement.at);
    if (Number.isFinite(stamp) && (!restocks.has(movement.productId) || restocks.get(movement.productId).stamp < stamp)) restocks.set(movement.productId,{at:movement.at,stamp});
  }
  const result = [];
  for (const product of state.products) {
    if (product.status === 'archived') continue;
    const stock = product.variants.reduce((sum,variant) => sum+variant.stock,0);
    if (!stock) continue;
    const sale = saleDates.get(product.id);
    const restock = restocks.get(product.id);
    const created = product.createdAt ? midnight(product.createdAt) : NaN;
    const baseline = sale?.stamp ?? Math.max(Number.isFinite(created) ? created : -Infinity,restock?.stamp ?? -Infinity);
    if (!Number.isFinite(baseline)) continue;
    const lastSaleAt = sale?.at || null;
    const daysIdle = Math.floor((today-baseline)/86400000);
    if (daysIdle >= threshold) result.push({...product,stock,stockCost:stock*product.cost,lastSaleAt,daysIdle});
  }
  return result.sort((a,b) => b.daysIdle-a.daysIdle || b.stockCost-a.stockCost);
}

export function purchaseSummary(state, now = new Date()) {
  const purchases = (state.purchases || []).filter(p => p.status !== 'canceled');
  const pending = purchases.filter(p => p.payment !== 'paid');
  const overdue = pending.filter(p => p.dueDate && p.dueDate < businessDay(now));
  return {pending,overdue,pendingCount:pending.length,overdueCount:overdue.length,pendingTotal:pending.reduce((sum,p) => sum+p.total,0),overdueTotal:overdue.reduce((sum,p) => sum+p.total,0),paidTotal:purchases.filter(p => p.payment === 'paid').reduce((sum,p) => sum+p.total,0)};
}

function purchaseItems(state, items) {
  if (!Array.isArray(items) || !items.length || items.length > 100) fail('Adicione de 1 a 100 variações à compra.');
  const result = [];
  for (const item of items) {
    const product = state.products.find(p => p.id === item.productId && p.status !== 'archived') || fail('Uma roupa da compra está indisponível.');
    const variant = product.variants.find(v => v.id === item.variantId) || fail('Uma variação da compra não existe mais.');
    const qty = integer(item.qty,'Quantidade da compra',1,100000);
    const unitCost = integer(item.unitCost,'Custo unitário',0,100000000);
    if (result.some(row => row.productId === product.id && row.variantId === variant.id)) fail('Não repita uma variação na compra; ajuste a quantidade na mesma linha.');
    result.push({productId:product.id,variantId:variant.id,qty,unitCost,name:product.name,color:variant.color,size:variant.size,sku:variant.sku});
  }
  const total = result.reduce((sum,item) => sum+item.qty*item.unitCost,0);
  integer(total,'Total da compra',1,100000000);
  return {items:result,total};
}

function receivePurchase(state, purchase, context) {
  if (purchase.status === 'received') return false;
  if (purchase.status !== 'ordered') fail('Somente uma compra em aberto pode receber mercadorias.');
  const updates = new Map();
  // Validate the whole receipt before changing any balance or average cost.
  for (const item of purchase.items) {
    const product = state.products.find(p => p.id === item.productId && p.status !== 'archived') || fail(`Restaure o cadastro de ${item.name} antes de receber a compra.`);
    const variant = product.variants.find(v => v.id === item.variantId) || fail(`Restaure a variação ${item.color}/${item.size} antes de receber a compra.`);
    integer(variant.stock+item.qty,'Saldo após recebimento',0,100000);
    const update = updates.get(product.id) || {product,qty:0,cost:0,lines:[]};
    update.qty += item.qty;update.cost += item.qty*item.unitCost;update.lines.push({variant,qty:item.qty});updates.set(product.id,update);
  }
  for (const update of updates.values()) {
    const stock = update.product.variants.reduce((sum,v) => sum+v.stock,0);
    update.product.cost = Math.round((stock*update.product.cost+update.cost)/(stock+update.qty));
    update.product.updatedAt = context.at;
    for (const line of update.lines) {
      line.variant.stock += line.qty;
      context.logMovement(state,update.product,line.variant,line.qty,`Compra ${purchase.number} · ${purchase.supplierName}`,context.at,context.actor);
    }
  }
  purchase.status = 'received';purchase.receivedAt = context.at;purchase.updatedAt = context.at;
  return true;
}

export function applyCommerceCommand(state, type, data, context) {
  ensureCommerceState(state);
  const {at,actor,demo} = context;
  switch (type) {
    case 'promotions.save': {
      const old = existingRecord(state.promotions,data.id,'Promoção');
      if (!['percent','fixed'].includes(data.kind)) fail('Tipo de promoção inválido.');
      const start = dateValue(data.start,'uma data inicial');const end = dateValue(data.end,'uma data final');
      if (start && end && start > end) fail('A data final deve ser igual ou posterior à inicial.');
      const promotion = {id:old?.id || crypto.randomUUID(),name:text(data.name,'o nome da promoção',120),productIds:productIds(state,data.productIds,true),kind:data.kind,value:integer(data.value,'Desconto',1,data.kind === 'percent' ? 100 : 100000000),start,end,active:data.active === true,createdAt:old?.createdAt || at,updatedAt:at};
      if (!old && state.promotions.length >= 500) fail('Limite de 500 promoções atingido.');
      if (old) state.promotions[state.promotions.indexOf(old)] = promotion;else state.promotions.unshift(promotion);
      return `Salvou a promoção ${promotion.name}`;
    }
    case 'promotions.archive': {
      const promotion = existingRecord(state.promotions,data.id,'Promoção') || fail('Selecione uma promoção.');
      promotion.active = false;promotion.updatedAt = at;return `Desativou a promoção ${promotion.name}`;
    }
    case 'suppliers.save': {
      const old = existingRecord(state.suppliers,data.id,'Fornecedor');
      const email = clean(data.email,180);if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('E-mail do fornecedor inválido.');
      const supplier = {id:old?.id || crypto.randomUUID(),name:text(data.name,'o nome do fornecedor',120),contact:clean(data.contact,100),phone:clean(data.phone,30),email,notes:clean(data.notes,2000),active:data.active !== false,createdAt:old?.createdAt || at,updatedAt:at};
      if (!old && state.suppliers.length >= 1000) fail('Limite de fornecedores atingido.');
      if (old) state.suppliers[state.suppliers.indexOf(old)] = supplier;else state.suppliers.unshift(supplier);
      return `Salvou o fornecedor ${supplier.name}`;
    }
    case 'purchases.save': {
      if (data.id) fail('Uma compra registrada não pode ser sobrescrita. Cancele a compra em aberto e cadastre outra.');
      if (state.purchases.length >= 5000) fail('Limite de compras atingido.');
      const supplier = state.suppliers.find(s => s.id === data.supplierId && s.active !== false) || fail('Escolha um fornecedor ativo.');
      const quote = purchaseItems(state,data.items);
      const date = dateValue(data.date || businessDay(at),'uma data da compra',false);
      const dueDate = dateValue(data.dueDate,'uma data de vencimento');
      if (dueDate && dueDate < date) fail('O vencimento não pode ser anterior à data da compra.');
      const purchase = {...quote,id:crypto.randomUUID(),number:`CMP-${String(state.purchases.length+1).padStart(4,'0')}`,supplierId:supplier.id,supplierName:supplier.name,date,dueDate,notes:clean(data.notes,2000),status:'ordered',payment:'pending',createdAt:at,updatedAt:at,receivedAt:null,paidAt:null};
      state.purchases.unshift(purchase);return `Registrou a compra ${purchase.number} com ${supplier.name}`;
    }
    case 'purchases.receive': {
      const purchase = existingRecord(state.purchases,data.id,'Compra') || fail('Selecione uma compra.');
      return receivePurchase(state,purchase,context) ? `Recebeu a compra ${purchase.number} e atualizou o estoque` : `A compra ${purchase.number} já foi recebida`;
    }
    case 'purchases.cancel': {
      const purchase = existingRecord(state.purchases,data.id,'Compra') || fail('Selecione uma compra.');
      if (purchase.status !== 'ordered' || purchase.payment === 'paid') fail('Somente compras em aberto e não pagas podem ser canceladas.');
      purchase.status = 'canceled';purchase.updatedAt = at;return `Cancelou a compra ${purchase.number}`;
    }
    case 'purchases.pay': {
      const purchase = existingRecord(state.purchases,data.id,'Compra') || fail('Selecione uma compra.');
      if (purchase.status === 'canceled') fail('Uma compra cancelada não pode receber pagamento.');
      if (purchase.payment === 'paid') return `O pagamento da compra ${purchase.number} já estava registrado`;
      purchase.payment = 'paid';purchase.paidAt = at;purchase.updatedAt = at;purchase.paidBy = actor;
      return `Registrou manualmente o pagamento da compra ${purchase.number}`;
    }
    case 'campaigns.save': {
      const old = existingRecord(state.campaigns,data.id,'Campanha');
      if (!['WhatsApp','Instagram','Outros'].includes(data.channel)) fail('Canal de marketing inválido.');
      if (!['draft','planned','done'].includes(data.status)) fail('Status da campanha inválido.');
      const campaign = {id:old?.id || crypto.randomUUID(),name:text(data.name,'o nome da campanha',120),channel:data.channel,status:data.status,date:dateValue(data.date,'uma data da campanha'),productIds:productIds(state,data.productIds || []),message:clean(data.message,4000),notes:clean(data.notes,2000),createdAt:old?.createdAt || at,updatedAt:at};
      if (!old && state.campaigns.length >= 1000) fail('Limite de campanhas atingido.');
      if (old) state.campaigns[state.campaigns.indexOf(old)] = campaign;else state.campaigns.unshift(campaign);
      return `Salvou a campanha ${campaign.name}; nenhum conteúdo foi enviado`;
    }
    case 'banners.save': {
      const old = existingRecord(state.banners,data.id,'Banner');
      if (!['catalog','promotions'].includes(data.target)) fail('Destino do banner inválido.');
      if (data.active === true && state.banners.filter(b => b.id !== old?.id && b.active === true).length >= 5) fail('Use até 5 banners ativos na vitrine.');
      const banner = {id:old?.id || crypto.randomUUID(),title:text(data.title,'o título do banner',100),subtitle:clean(data.subtitle,240),eyebrow:clean(data.eyebrow,60),buttonText:clean(data.buttonText,60) || 'Ver coleção',target:data.target,image:data.image ? context.imagePath(data.image,demo) : '',active:data.active === true,position:integer(data.position ?? 0,'Posição do banner',0,1000),createdAt:old?.createdAt || at,updatedAt:at};
      if (!old && state.banners.length >= 100) fail('Limite de banners atingido.');
      if (old) state.banners[state.banners.indexOf(old)] = banner;else state.banners.unshift(banner);
      return `Salvou o banner ${banner.title}`;
    }
    case 'banners.archive': {
      const banner = existingRecord(state.banners,data.id,'Banner') || fail('Selecione um banner.');
      banner.active = false;banner.updatedAt = at;return `Desativou o banner ${banner.title}`;
    }
    default: return undefined;
  }
}
