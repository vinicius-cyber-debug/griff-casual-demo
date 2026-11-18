import { calculateTotals, money } from './shop.js';

// wa.me requires an international number without punctuation or a leading +.
export function normalizeWhatsAppPhone(value) {
  if (typeof value !== 'string' || !/^\+?[\d\s().-]+$/.test(value.trim())) return '';
  const digits = value.replace(/\D/g, '');
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : '';
}

const singleLine = (value, max) => String(value || '').replace(/[\r\n\t\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max);

export function createWhatsAppCheckout({ phone, cart, catalog, customerName = '', delivery = '', notes = '', demonstration = false }) {
  const number = normalizeWhatsAppPhone(phone);
  const totals = calculateTotals(cart, catalog);
  if (!number || !totals.quantity) return null;
  const name = singleLine(customerName, 80);
  const observation = singleLine(notes, 500);
  const deliveryLabel = delivery === 'delivery' ? 'Entrega (endereço e frete a combinar)' : delivery === 'pickup' ? 'Retirada (local e horário a combinar)' : 'A combinar com a loja';
  const message = [
    'Olá, Griff Casual! Gostaria de confirmar estas peças:',
    ...(demonstration ? ['Vitrine demonstrativa: confirmar produtos e preços com a loja.'] : []),
    ...(name ? [`Nome: ${name}`] : []),
    '',
    ...totals.lines.flatMap((row, index) => [
      `${index + 1}. ${row.qty}× ${singleLine(row.product.name, 120)}`,
      `Tamanho: ${singleLine(row.size, 30)}${row.color ? ` | Cor: ${singleLine(row.color, 50)}` : ''}`,
      `Unitário: ${money(row.product.price)} | Total: ${money(row.product.price * row.qty)}`,
      ''
    ]),
    `Subtotal das peças: ${money(totals.subtotal)}`,
    `Recebimento: ${deliveryLabel}`,
    'Frete e forma de pagamento: a combinar.',
    ...(observation ? [`Observações: ${observation}`] : []),
    '',
    'Aguardo a confirmação de disponibilidade, preços e valor final pela loja.'
  ].join('\n');
  return { url: `https://wa.me/${number}?text=${encodeURIComponent(message)}`, message, ...totals };
}
