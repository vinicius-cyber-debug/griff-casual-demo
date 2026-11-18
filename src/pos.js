import { orderQuote, toCents } from './domain.js';
import { normalize } from './shop.js';

export function posProducts(state, query = '', category = '') {
  const search = normalize(query.trim());
  return state.products.filter(p => p.status === 'active' && (!category || p.category === category) && normalize(`${p.name} ${p.sku} ${p.variants.map(v => v.sku).join(' ')}`).includes(search));
}

export function changePosQuantity(state, cart, productId, variantId, delta) {
  const product = state.products.find(p => p.id === productId && p.status === 'active');
  const variant = product?.variants.find(v => v.id === variantId);
  const existing = cart.find(row => row.productId === productId && row.variantId === variantId);
  const quantity = (existing?.qty || 0) + delta;
  if (!Number.isInteger(delta) || !delta) throw new Error('Quantidade inválida.');
  if (quantity <= 0) return cart.filter(row => row !== existing);
  if (!variant || quantity > Math.min(999, variant.stock)) throw new Error('Quantidade acima do estoque disponível. Revise esta variação.');
  if (!existing && cart.length >= 100) throw new Error('Limite de 100 variações por venda.');
  return existing ? cart.map(row => row === existing ? {...row,qty:quantity} : row) : [...cart,{productId,variantId,qty:quantity}];
}

export function posQuote(state, items, coupon = '') {
  return orderQuote(state, {items,coupon,shipping:0});
}

export function posPayment(quote, method, received) {
  if (!quote) return {receivedAmount:0,change:0,error:''};
  if (method !== 'cash') return {receivedAmount:quote.total,change:0,error:''};
  try {
    const receivedAmount = toCents(received);
    return {receivedAmount,change:Math.max(0,receivedAmount-quote.total),error:receivedAmount < quote.total ? 'O valor recebido precisa cobrir o total da venda.' : ''};
  } catch { return {receivedAmount:0,change:0,error:'Informe o valor recebido em dinheiro.'}; }
}

export function readPosDraft(key) {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || '{}');
    const items = Array.isArray(value.items) ? value.items.filter(row => typeof row?.productId === 'string' && typeof row.variantId === 'string' && Number.isInteger(row.qty) && row.qty > 0 && row.qty <= 999).slice(0,100) : [];
    return {items,pending:value.pending && typeof value.pending.reference === 'string' ? value.pending : null};
  } catch { return {items:[],pending:null}; }
}
