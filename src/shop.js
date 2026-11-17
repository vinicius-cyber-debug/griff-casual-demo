export const products = [
  { id: 'tee-black', name: 'Camiseta Essential Black', category: 'Camisetas', collection: 'Essentials', price: 8990, image: 'tee-black', alt: 'Camiseta preta básica de manga curta', colors: ['#222522', '#d8d4c8'], sizes: ['P', 'M', 'G', 'GG'], badge: 'ESSENTIAL', description: 'A base de qualquer corre. Camiseta de modelagem confortável para combinar do seu jeito.' },
  { id: 'hoodie', name: 'Moletom Urban Grey', category: 'Moletons', collection: 'Urban', price: 21990, image: 'hoodie', alt: 'Modelo de costas usando moletom cinza com capuz', colors: ['#a5acac'], sizes: ['P', 'M', 'G', 'GG'], badge: 'NOVO DROP', description: 'Capuz e atitude de sobra. Uma camada a mais para acompanhar a cidade.' },
  { id: 'tee-white', name: 'Camiseta Off White', category: 'Camisetas', collection: 'Essentials', price: 9990, image: 'tee-white', alt: 'Camiseta branca de manga curta', colors: ['#e5e3dc', '#262626'], sizes: ['P', 'M', 'G', 'GG'], badge: '', description: 'Visual limpo, presença forte. Uma camiseta versátil para entrar na sua rotação de favoritos.' },
  { id: 'cargo', name: 'Calça Slim Street', category: 'Calças', collection: 'Urban', price: 18990, image: 'cargo', alt: 'Modelo usando calça slim em tom cáqui com tênis branco', colors: ['#85826a'], sizes: ['38', '40', '42', '44'], badge: 'URBAN', description: 'Silhueta urbana em tom neutro. Uma proposta para compor com seus essenciais.' },
  { id: 'tee-green', name: 'Camiseta Street Graphic', category: 'Camisetas', collection: 'Urban', price: 10990, image: 'tee-green', alt: 'Modelo usando camiseta preta com estampa de uma mão de esqueleto', colors: ['#222222'], sizes: ['P', 'M', 'G', 'GG'], badge: 'NOVO DROP', description: 'Uma estampa que fala por você. Presença e personalidade para mudar o look inteiro.' },
  { id: 'cap', name: 'Boné Everyday White', category: 'Acessórios', collection: 'Essentials', price: 6990, image: 'cap', alt: 'Boné branco com aba curva', colors: ['#e1e1df'], sizes: ['Único'], badge: '', description: 'O detalhe que fecha o visual. Boné de aba curva para acompanhar todos os seus dias.' },
  { id: 'jacket', name: 'Jaqueta Urban Olive', category: 'Jaquetas', collection: 'Urban', price: 24990, image: 'jacket', alt: 'Modelo usando jaqueta verde oliva com bolsos frontais', colors: ['#65614a'], sizes: ['P', 'M', 'G', 'GG'], badge: '', description: 'Sobreposição com personalidade. Uma peça para combinar e fazer sua.' },
  { id: 'tee-sand', name: 'Camiseta Graphic Cropped', category: 'Camisetas', collection: 'Urban', price: 8990, image: 'tee-sand', alt: 'Modelo usando camiseta preta curta com estampa gráfica', colors: ['#222222'], sizes: ['P', 'M', 'G', 'GG'], badge: 'URBAN', description: 'Estampa gráfica e silhueta mais curta. Uma combinação para vestir sua atitude.' }
];

export const money = cents => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
export const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function filterProducts({ category = 'Todos', query = '', favoritesOnly = false, favorites = [], sort = 'featured' } = {}, catalog = products) {
  const result = catalog.filter(p => (category === 'Todos' || p.category === category || p.collection === category) && (!favoritesOnly || favorites.includes(p.id)) && normalize(`${p.name} ${p.category} ${p.collection}`).includes(normalize(query.trim())));
  if (sort === 'price-asc') result.sort((a, b) => a.price - b.price);
  if (sort === 'price-desc') result.sort((a, b) => b.price - a.price);
  return result;
}
export function sanitizeCart(value, catalog = products) {
  if (!Array.isArray(value)) return [];
  const result = [];
  for (const row of value) {
    const p = catalog.find(p => p.id === row?.id);
    if (!p || !p.sizes.includes(row.size) || !Number.isInteger(row.qty) || row.qty < 1) continue;
    const variant = p.variants?.find(v => row.variantId ? v.id === row.variantId && v.size === row.size : v.size === row.size && (!row.color || v.color === row.color));
    if (p.variants && (!variant || variant.stock < 1)) continue;
    const limit = Math.min(10, variant?.stock ?? 10);
    const existing = result.find(x => x.id === row.id && (variant ? x.variantId === variant.id : x.size === row.size));
    if (existing) existing.qty = Math.min(limit, existing.qty + row.qty);
    else result.push({ id: row.id, size: row.size, qty: Math.min(limit, row.qty), ...(variant ? {variantId:variant.id,color:variant.color} : {}) });
  }
  return result;
}
export function calculateTotals(cart, catalog = products) {
  const lines = sanitizeCart(cart, catalog).map(row => ({ ...row, product: catalog.find(p => p.id === row.id) }));
  const subtotal = lines.reduce((total, row) => total + row.product.price * row.qty, 0);
  return { lines, subtotal, quantity: lines.reduce((n, row) => n + row.qty, 0) };
}
