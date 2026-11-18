import React, { useEffect, useRef, useState } from 'react';
import { useStore } from './store.jsx';
import { money } from './shop.js';
import { paymentLabels, productImage, statusLabels } from './domain.js';
import { changePosQuantity, posPayment, posProducts, posQuote, readPosDraft } from './pos.js';
import {effectiveProduct} from './commerce.js';
import './pos.css';

function VariantPicker({ product, onSelect, onClose, error }) {
  const ref = useRef(null);
  useEffect(() => { ref.current.showModal(); }, []);
  return <dialog className="ad-modal pos-picker" ref={ref} aria-labelledby="pos-picker-title" onCancel={e => {e.preventDefault();onClose();}}>
    <div className="ad-modal-head"><div><span className="ad-overline">ESCOLHA A VARIAÇÃO</span><h2 id="pos-picker-title">{product.name}</h2></div><button className="ad-icon" aria-label="Fechar seleção de variação" onClick={onClose}>×</button></div>
    <div className="ad-modal-content">{error && <p className="ad-error" role="alert">{error}</p>}<strong className="pos-picker-price">{money(product.price)}</strong><p>Toque no tamanho e na cor para adicionar uma unidade.</p><div className="pos-variants">{product.variants.map(v => <button key={v.id} disabled={!v.stock} onClick={() => onSelect(product.id,v.id)}><strong>{v.size}</strong><span>{v.color}</span><small>{v.stock ? `${v.stock} disponíveis` : 'Esgotado'}</small></button>)}</div></div>
  </dialog>;
}

export function ReceiptBody({order,storeName,demo}) {
  return <article className="pos-receipt" aria-label="Resumo da venda presencial">
      <header><strong>{storeName}</strong><span>VENDA PRESENCIAL · {order.number}</span><small>{new Date(order.createdAt).toLocaleString('pt-BR',{timeZone:'America/Manaus'})}</small></header>
      {demo && <p className="pos-receipt-demo">DEMONSTRAÇÃO · SEM VALOR COMERCIAL</p>}
      <p>Cliente: {order.customer.name}</p>
      <div className="pos-receipt-items">{order.items.map((item,i) => <div key={i}><span><b>{item.qty}× {item.name}</b><small>{item.color} / {item.size} · {money(item.unitPrice)} cada</small></span><strong>{money(item.qty*item.unitPrice)}</strong></div>)}</div>
      <dl><div><dt>Subtotal</dt><dd>{money(order.subtotal)}</dd></div>{order.discount > 0 && <div><dt>Desconto {order.coupon}</dt><dd>− {money(order.discount)}</dd></div>}<div className="pos-receipt-total"><dt>Total</dt><dd>{money(order.total)}</dd></div><div><dt>Pagamento</dt><dd>{paymentLabels[order.method]}</dd></div><div><dt>Situação</dt><dd>{statusLabels[order.payment]} · {statusLabels[order.status]}</dd></div>{order.method === 'cash' && <><div><dt>Recebido em dinheiro</dt><dd>{money(order.receivedAmount)}</dd></div><div><dt>Troco</dt><dd>{money(order.change)}</dd></div></>}</dl>
      {order.notes && <p>Observações: {order.notes}</p>}
      <footer>Resumo da venda. Este documento não é uma nota fiscal.<br/>Recebimento informado manualmente pelo operador.</footer>
    </article>;
}

function Receipt({ order, storeName, demo, onNew, onOpenOrder }) {
  return <section className="ad-card pos-success">
    <div className="pos-success-heading"><span aria-hidden="true">✓</span><div><span className="ad-overline">{demo ? 'VENDA DE TESTE' : 'VENDA REGISTRADA'}</span><h2>Tudo certo no balcão.</h2><p>Pagamento registrado e estoque atualizado.</p></div></div>
    <ReceiptBody order={order} storeName={storeName} demo={demo}/>
    <div className="pos-success-actions"><button className="ad-button primary" onClick={onNew}>Iniciar nova venda</button><button className="ad-button secondary" onClick={() => window.print()}>Imprimir / salvar PDF</button><button className="ad-text-button" onClick={() => onOpenOrder(order.id)}>Ver no histórico de pedidos →</button></div>
  </section>;
}

export default function PointOfSale({ onOpenOrder }) {
  const store = useStore();
  const {state,busy,demo} = store;
  const storageKey = `griff:pos:${demo ? 'demo' : store.user.id}`;
  const [draft,setDraft] = useState(() => readPosDraft(storageKey));
  const [query,setQuery] = useState('');
  const [category,setCategory] = useState('');
  const [selected,setSelected] = useState(null);
  const [step,setStep] = useState('catalog');
  const [method,setMethod] = useState('pix');
  const [received,setReceived] = useState('');
  const [customerId,setCustomerId] = useState('');
  const [customerName,setCustomerName] = useState('');
  const [notes,setNotes] = useState('');
  const [couponInput,setCouponInput] = useState('');
  const [coupon,setCoupon] = useState('');
  const [confirmed,setConfirmed] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [receiptId,setReceiptId] = useState(null);
  const requestLock = useRef(false);
  const locked = busy || Boolean(draft.pending);
  const receipt = state.orders.find(order => order.id === receiptId);
  let quote = null;
  let quoteError = '';
  if (draft.items.length) { try {quote = posQuote(state,draft.items,coupon);} catch(e) {quoteError = e.message;} }
  const payment = posPayment(quote,method,received);
  const quantity = draft.items.reduce((sum,row) => sum+row.qty,0);
  const products = posProducts(state,query,category).map(p=>effectiveProduct(p,state.promotions||[]));
  const selectedProduct = state.products.find(p => p.id === selected);
  const pricedSelectedProduct = selectedProduct ? effectiveProduct(selectedProduct,state.promotions||[]) : null;
  const currentTotal = quote?.total || 0;

  function persist(value) { sessionStorage.setItem(storageKey,JSON.stringify(value)); }
  useEffect(() => {try {persist(draft);} catch { /* Checkout verifies that recovery information can be saved before submitting. */ }},[draft,storageKey]);
  useEffect(() => {setConfirmed(false);},[currentTotal,method,received,draft.items,coupon]);
  useEffect(() => {
    if (!draft.pending) return;
    const recorded = state.orders.find(order => order.posReference === draft.pending.reference);
    if (recorded) finish(recorded);
  },[state.orders,draft.pending]);

  function finish(order) {
    setReceiptId(order.id);setDraft({items:[],pending:null});setConfirmed(false);setError('');setNotice('');setCoupon('');setCouponInput('');setReceived('');setCustomerId('');setCustomerName('');setNotes('');
  }
  function change(productId,variantId,delta) {
    if (locked) return false;
    try {
      setDraft({...draft,items:changePosQuantity(state,draft.items,productId,variantId,delta)});
      setError('');setNotice(delta > 0 ? 'Peça adicionada à venda.' : 'Quantidade atualizada.');setConfirmed(false);return true;
    } catch(e) {setError(e.message);return false;}
  }
  function remove(productId,variantId) {setDraft({...draft,items:draft.items.filter(row => row.productId !== productId || row.variantId !== variantId)});setConfirmed(false);}
  function applyCoupon() {
    try {posQuote(state,draft.items,couponInput.trim());setCoupon(couponInput.trim().toUpperCase());setError('');} catch(e) {setError(e.message);}
  }
  async function checkout(event) {
    event.preventDefault();
    if (requestLock.current || busy) return;
    setError('');
    let payload = draft.pending;
    if (!payload) {
      if (!quote || quoteError || payment.error || !confirmed) {setError(quoteError || payment.error || 'Confira a sacola e confirme o recebimento para concluir.');return;}
      payload = {reference:crypto.randomUUID(),items:draft.items,coupon,shipping:0,expectedTotal:quote.total,method,receivedAmount:payment.receivedAmount,confirmReceived:true,customerId:customerId || undefined,customer:{name:customerName.trim() || 'Cliente balcão'},saveCustomer:false,notes};
      const pendingDraft = {...draft,pending:payload};
      try {persist(pendingDraft);} catch {setError('Habilite o armazenamento do navegador para guardar a referência da venda antes de concluir.');return;}
      setDraft(pendingDraft);
    }
    requestLock.current = true;
    try {
      const next = await store.run('pos.checkout',payload);
      const order = next.orders.find(o => o.posReference === payload.reference);
      if (!order) throw new Error('Confira o histórico antes de iniciar outra venda.');
      finish(order);
    } catch(e) {
      if (e.status === 400 || e.status === 409 || demo) {setDraft(previous => ({...previous,pending:null}));setConfirmed(false);}
      setError(e.message);
    } finally {requestLock.current = false;}
  }

  if (receipt) return <Receipt order={receipt} storeName={state.settings.name} demo={demo} onNew={() => {setReceiptId(null);setStep('catalog');}} onOpenOrder={onOpenOrder}/>;
  return <div className={`pos-layout pos-step-${step}`}>
    <section className="pos-catalog" aria-label="Catálogo do PDV">
      <div className="pos-search"><label><span className="sr-only">Buscar roupa no PDV</span><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar roupa ou código SKU…" autoComplete="off"/></label><span>{products.length} roupas</span></div>
      <div className="pos-categories" aria-label="Categorias do PDV"><button aria-pressed={!category} onClick={() => setCategory('')}>Todas</button>{state.categories.map(c => <button key={c} aria-pressed={category === c} onClick={() => setCategory(c)}>{c}</button>)}</div>
      <div className="pos-products">{products.map(p => {const stock = p.variants.reduce((sum,v) => sum+v.stock,0);return <button className="pos-product" key={p.id} disabled={locked || !stock} onClick={() => {setError('');setSelected(p.id);}} aria-label={`Adicionar ${p.name}`}><div className="pos-product-photo"><img src={productImage(p)} alt="" loading="lazy"/><span>{stock ? `${stock} em estoque` : 'Esgotado'}</span></div><div className="pos-product-copy"><small>{p.category}</small><strong>{p.name}</strong><span>{money(p.price)}<b aria-hidden="true">+</b></span></div></button>;})}</div>
      {!products.length && <div className="ad-empty"><h3>Nenhuma roupa encontrada</h3><p>Tente outro nome, código ou categoria.</p></div>}
      <p className="pos-catalog-note">Tamanho e cor são escolhidos antes de adicionar à venda.</p>
    </section>

    <section className="ad-card pos-cart" aria-labelledby="pos-cart-title">
      <div className="pos-cart-heading"><div><span className="ad-overline">ATENDIMENTO NO BALCÃO</span><h2 id="pos-cart-title">Venda atual <span>({quantity})</span></h2></div><button className="ad-text-button pos-back" onClick={() => setStep('catalog')}>← Adicionar peças</button></div>
      {notice && <p className="pos-notice" role="status">{notice}</p>}
      {!draft.items.length ? <div className="ad-empty pos-cart-empty"><span aria-hidden="true">＋</span><h3>A próxima venda começa aqui.</h3><p>Escolha uma roupa e selecione tamanho e cor.</p></div> : <>
        <div className="pos-cart-lines">{draft.items.map(row => {
          const rawProduct = state.products.find(p => p.id === row.productId);
          const product = rawProduct ? effectiveProduct(rawProduct,state.promotions||[]) : null;
          const variant = product?.variants.find(v => v.id === row.variantId);
          const label = `${product?.name || 'Roupa indisponível'}, ${variant?.color || ''}/${variant?.size || ''}`;
          return <div className="pos-cart-line" key={`${row.productId}-${row.variantId}`}><img src={productImage(product)} alt=""/><div><strong>{product?.name || 'Roupa indisponível'}</strong><small>{variant ? `${variant.color} / ${variant.size}` : 'Variação indisponível'}</small><b>{money((product?.price || 0)*row.qty)}</b><div className="pos-quantity"><button aria-label={`Diminuir ${label}`} disabled={locked} onClick={() => change(row.productId,row.variantId,-1)}>−</button><output aria-label={`Quantidade de ${label}`}>{row.qty}</output><button aria-label={`Aumentar ${label}`} disabled={locked || !variant || row.qty >= Math.min(999,variant.stock)} onClick={() => change(row.productId,row.variantId,1)}>+</button></div></div><button className="ad-icon pos-remove" aria-label={`Remover ${label}`} disabled={locked} onClick={() => remove(row.productId,row.variantId)}>×</button></div>;
        })}</div>
        {quoteError && <p className="ad-error" role="alert">{quoteError} Remova ou ajuste os itens para continuar.</p>}
        <form onSubmit={checkout} className="pos-payment-form">
          <fieldset disabled={locked}>
            <label className="ad-field"><span>Cliente</span><select value={customerId} onChange={e => setCustomerId(e.target.value)}><option value="">Consumidor no balcão</option>{state.customers.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
            {!customerId && <label className="ad-field"><span>Nome do cliente <small>(opcional)</small></span><input value={customerName} onChange={e => setCustomerName(e.target.value)} maxLength={100} placeholder="Cliente balcão" autoComplete="off"/></label>}
            <div className="pos-coupon"><label className="ad-field"><span>Cupom de desconto</span><input value={couponInput} onChange={e => setCouponInput(e.target.value)} maxLength={40} placeholder="Código do cupom" autoComplete="off"/></label><button className="ad-button secondary" type="button" onClick={applyCoupon}>Aplicar</button></div>
            {coupon && <p className="pos-applied-coupon">Cupom {coupon} <button type="button" onClick={() => {setCoupon('');setCouponInput('');}}>Remover</button></p>}
            <div className="pos-totals"><div><span>Subtotal</span><b>{money(quote?.subtotal || 0)}</b></div>{Boolean(quote?.discount) && <div><span>Desconto</span><b>− {money(quote.discount)}</b></div>}<div className="pos-grand-total"><span>Total da venda</span><strong>{money(currentTotal)}</strong></div></div>
            <fieldset className="pos-payment-methods"><legend>Forma de pagamento</legend>{['pix','card','cash'].map(value => <label key={value} className={method === value ? 'selected' : ''}><input type="radio" name="pos-payment" value={value} checked={method === value} onChange={() => setMethod(value)}/><span>{paymentLabels[value]}</span></label>)}</fieldset>
            {method === 'cash' && <><label className="ad-field"><span>Valor recebido em dinheiro (R$)</span><input inputMode="decimal" value={received} onChange={e => setReceived(e.target.value)} placeholder="0,00" autoComplete="off"/></label><div className="pos-change"><span>Troco</span><strong>{money(payment.change)}</strong></div>{payment.error && <p className="pos-validation">{payment.error}</p>}</>}
            <label className="ad-field"><span>Observações <small>(opcional)</small></span><textarea rows={2} value={notes} maxLength={2000} onChange={e => setNotes(e.target.value)} placeholder="Detalhes deste atendimento"/></label>
            <label className="ad-checkbox pos-confirm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/><span>Confirmo que recebi {money(currentTotal)} {method === 'pix' ? 'via Pix' : method === 'cash' ? 'em dinheiro, descontando o troco' : 'na maquininha'} e entreguei as peças.</span></label>
          </fieldset>
          {draft.pending && <div className="ad-error" role="status">Esta venda aguarda confirmação do servidor. Verifique o registro antes de iniciar outra; a mesma referência será usada para evitar duplicidade.</div>}
          {error && <p className="ad-error" role="alert">{error}</p>}
          <button className="ad-button primary pos-finish" type="submit" disabled={busy || (!draft.pending && (!quote || Boolean(payment.error) || !confirmed))}>{busy ? 'Registrando venda…' : draft.pending ? 'Verificar registro da venda' : `Concluir venda · ${money(currentTotal)}`}</button>
          <p className="pos-manual-payment">O PDV registra o recebimento informado. Pix e cartão são cobrados fora do sistema. A conclusão dá baixa no estoque.</p>
        </form>
      </>}
      {error && !draft.items.length && <p className="ad-error" role="alert">{error}</p>}
    </section>
    {quantity > 0 && <button className="pos-mobile-cart ad-button primary" onClick={() => {setStep('cart');window.scrollTo({top:0,behavior:'smooth'});}}><span>Ver sacola ({quantity})</span><strong>{money(currentTotal)}</strong><span aria-hidden="true">→</span></button>}
    {selectedProduct && <VariantPicker error={error} product={pricedSelectedProduct} onClose={() => setSelected(null)} onSelect={(productId,variantId) => {if(change(productId,variantId,1))setSelected(null);}}/>}
  </div>;
}
