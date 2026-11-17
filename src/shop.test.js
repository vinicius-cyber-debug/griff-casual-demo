import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTotals, sanitizeCart, filterProducts } from './shop.js';
test('subtotal usa centavos e soma variantes de tamanho separadamente', () => {
  const result = calculateTotals([{ id: 'tee-black', size: 'M', qty: 2 }, { id: 'tee-black', size: 'G', qty: 1 }, { id: 'hoodie', size: 'GG', qty: 1 }]);
  assert.equal(result.subtotal, 48960); assert.equal(result.quantity, 4); assert.equal(result.lines.length, 3);
});
test('dados persistidos inválidos não alteram preço, tamanho ou quantidade', () => {
  assert.deepEqual(sanitizeCart([{ id: 'fake', size: 'M', qty: 1 }, { id: 'hoodie', size: 'XXL', qty: 2 }, { id: 'tee-black', size: 'M', qty: -1 }, { id: 'hoodie', size: 'M', qty: 1.5 }, null]), []);
  assert.deepEqual(sanitizeCart([{ id: 'hoodie', size: 'M', qty: 8 }, { id: 'hoodie', size: 'M', qty: 8, price: 0 }]), [{ id: 'hoodie', size: 'M', qty: 10 }]);
  assert.equal(calculateTotals([{ id: 'hoodie', size: 'M', qty: 1, price: 0 }]).subtotal, 21990);
});
test('busca ignora acentos e combina categoria, favoritos e ordenação', () => {
  assert.equal(filterProducts({ query: 'CALCA' })[0].id, 'cargo');
  assert.equal(filterProducts({ category: 'Moletons', query: 'camiseta' }).length, 0);
  assert.deepEqual(filterProducts({ favoritesOnly: true, favorites: ['hoodie', 'tee-black'], sort: 'price-asc' }).map(p => p.id), ['tee-black', 'hoodie']);
  assert.deepEqual(filterProducts({ favoritesOnly: true }), []);
});
