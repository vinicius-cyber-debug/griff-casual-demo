import test from 'node:test';
import assert from 'node:assert/strict';
import { createWhatsAppCheckout, normalizeWhatsAppPhone } from './checkout.js';

const phone = '+55 92 98520-7901';
const catalog = [{ id: 'tee', name: 'Camiseta Rua & Arte', price: 8990, sizes: ['M'], variants: [{ id: 'green-m', size: 'M', color: 'Verde', stock: 2 }, { id: 'black-m', size: 'M', color: 'Preto', stock: 1 }] }];
const cart = [{ id: 'tee', variantId: 'green-m', size: 'M', qty: 2, price: 1 }, { id: 'tee', variantId: 'black-m', size: 'M', qty: 1 }];

test('WhatsApp recebe número internacional normalizado e rejeita destinos inválidos', () => {
  assert.equal(normalizeWhatsAppPhone(phone), '5592985207901');
  for (const value of ['', null, '0000000000', '123', 'https://wa.me/5592985207901', '+55 92 98520-7901?text=fake', '+551234567890123456']) assert.equal(normalizeWhatsAppPhone(value), '');
  assert.equal(createWhatsAppCheckout({ phone: '', cart, catalog }), null);
  assert.equal(createWhatsAppCheckout({ phone, cart: [], catalog }), null);
});

test('mensagem usa preços do catálogo, separa cores, respeita estoque e não modifica a sacola', () => {
  const before = structuredClone(cart);
  const result = createWhatsAppCheckout({ phone, cart, catalog, delivery: 'delivery', demonstration: true });
  assert.equal(result.subtotal, 26970);
  assert.equal(result.quantity, 3);
  assert.match(result.message, /2× Camiseta Rua & Arte/);
  assert.match(result.message, /Cor: Verde/);
  assert.match(result.message, /Cor: Preto/);
  assert.match(result.message, /269,70/);
  assert.match(result.message, /frete a combinar/);
  assert.match(result.message, /Vitrine demonstrativa/);
  assert.deepEqual(cart, before);
  assert.equal(createWhatsAppCheckout({ phone, cart: [{ ...cart[0], qty: 9 }], catalog }).quantity, 2);
});

test('acentos e caracteres de cliente ficam dentro da mensagem sem alterar o destino', () => {
  const result = createWhatsAppCheckout({ phone, cart, catalog, customerName: 'João\nSubtotal: 0', delivery: 'pickup', notes: 'Portão #2 & referência = Café? 😊' });
  const url = new URL(result.url);
  assert.equal(url.origin, 'https://wa.me');
  assert.equal(url.pathname, '/5592985207901');
  assert.deepEqual([...url.searchParams.keys()], ['text']);
  assert.equal(url.searchParams.get('text'), result.message);
  assert.match(result.message, /Nome: João Subtotal: 0/);
  assert.match(result.message, /Retirada/);
  assert.match(result.message, /Portão #2 & referência = Café\? 😊/);
});
