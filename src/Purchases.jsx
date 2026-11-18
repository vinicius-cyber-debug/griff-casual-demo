import React, { useEffect, useState } from 'react';
import { useStore } from './store.jsx';
import { money, normalize } from './shop.js';
import { dateLabel, productImage, toCents } from './domain.js';
import AdminTable from './AdminTable.jsx';
import { Button, Field, Form, Modal } from './ManagementUI.jsx';
import './purchases.css';

const statusLabels = {ordered:'Aguardando entrega',received:'Recebida',canceled:'Cancelada',pending:'A pagar',paid:'Pago'};
function localDate() {
  const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Manaus',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  return ['year','month','day'].map(type => parts.find(part => part.type === type).value).join('-');
}
const labelDate = value => value ? dateLabel(value) : 'Sem data';
function PurchaseStatus({value,overdue = false}) {return <span className={`purchase-state ${overdue ? 'overdue' : value}`}>{overdue ? 'Vencido' : statusLabels[value] || value}</span>;}
function Empty({title,text,children}) {return <div className="ad-empty purchase-empty"><span aria-hidden="true">＋</span><h3>{title}</h3><p>{text}</p>{children}</div>;}

function SupplierForm({supplier,onSave}) {
  const [form,setForm] = useState({name:'',contact:'',phone:'',email:'',notes:'',active:true,...supplier});
  const change = key => event => setForm(previous => ({...previous,[key]:event.target.value}));
  return <Form label={supplier ? 'Salvar fornecedor' : 'Cadastrar fornecedor'} onSubmit={() => onSave(form)}>
    <Field label="Nome do fornecedor *" value={form.name} onChange={change('name')} maxLength={120} required/>
    <Field label="Pessoa de contato" value={form.contact} onChange={change('contact')} maxLength={100}/>
    <div className="ad-form-row"><Field label="Telefone / WhatsApp" type="tel" inputMode="tel" value={form.phone} onChange={change('phone')} maxLength={30}/><Field label="E-mail" type="email" value={form.email} onChange={change('email')} maxLength={180}/></div>
    <Field label="Observações"><textarea value={form.notes} onChange={change('notes')} maxLength={1000} rows={3} placeholder="Condições de compra, prazo de entrega ou outros detalhes"/></Field>
    <label className="ad-checkbox"><input type="checkbox" checked={form.active} onChange={event => setForm(previous => ({...previous,active:event.target.checked}))}/>Fornecedor ativo para novas compras</label>
  </Form>;
}

function PurchaseForm({suppliers,products,onSave}) {
  const [form,setForm] = useState({supplierId:'',date:localDate(),dueDate:'',notes:''});
  const [items,setItems] = useState([]);
  const [productId,setProductId] = useState('');
  const [variantId,setVariantId] = useState('');
  const [qty,setQty] = useState('1');
  const [cost,setCost] = useState('');
  const [itemError,setItemError] = useState('');
  const selected = products.find(product => product.id === productId);
  const activeSuppliers = suppliers.filter(supplier => supplier.active !== false);
  const available = products.filter(product => product.status !== 'archived');
  const total = items.reduce((sum,item) => sum+item.qty*item.unitCost,0);
  const change = key => event => setForm(previous => ({...previous,[key]:event.target.value}));
  function addItem() {
    try {
      if (!selected || !selected.variants.some(variant => variant.id === variantId)) throw new Error('Escolha uma roupa, tamanho e cor.');
      const quantity = Number(qty);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000) throw new Error('Informe uma quantidade inteira entre 1 e 100.000.');
      const unitCost = toCents(cost);
      if (unitCost < 1) throw new Error('Informe um custo unitário maior que zero.');
      const duplicate = items.find(item => item.productId === productId && item.variantId === variantId);
      if (duplicate && duplicate.unitCost !== unitCost) throw new Error('Esta variação já está na compra com outro custo. Remova a linha para corrigir o valor.');
      if (duplicate && duplicate.qty+quantity > 100000) throw new Error('A quantidade dessa variação excede o limite por compra.');
      if (!duplicate && items.length >= 100) throw new Error('Use até 100 variações por compra.');
      setItems(previous => duplicate ? previous.map(item => item === duplicate ? {...item,qty:item.qty+quantity} : item) : [...previous,{productId,variantId,qty:quantity,unitCost}]);
      setProductId('');setVariantId('');setQty('1');setCost('');setItemError('');
    } catch(error) {setItemError(error.message);}
  }
  return <Form label="Registrar compra" onSubmit={() => {
    if (!items.length) throw new Error('Adicione pelo menos uma roupa à compra.');
    return onSave({...form,items});
  }}>
    <p className="purchase-help">Registre o pedido ao fornecedor. O estoque será atualizado quando você confirmar o recebimento das peças.</p>
    <Field label="Fornecedor *"><select value={form.supplierId} onChange={change('supplierId')} required><option value="">Selecione um fornecedor</option>{activeSuppliers.map(supplier => <option value={supplier.id} key={supplier.id}>{supplier.name}</option>)}</select></Field>
    <div className="ad-form-row"><Field label="Data da compra *" type="date" value={form.date} onChange={change('date')} required/><Field label="Vencimento do pagamento" type="date" value={form.dueDate} onChange={change('dueDate')} hint="Deixe em branco quando ainda não houver prazo combinado."/></div>
    <h3 className="ad-form-title">Peças da reposição</h3>
    <Field label="Roupa"><select value={productId} onChange={event => {const product=available.find(product => product.id === event.target.value);setProductId(event.target.value);setVariantId('');setCost(product ? String(product.cost/100) : '');}}><option value="">Selecione uma roupa cadastrada</option>{available.map(product => <option value={product.id} key={product.id}>{product.name} · {product.sku}</option>)}</select></Field>
    <Field label="Tamanho e cor"><select value={variantId} onChange={event => setVariantId(event.target.value)}><option value="">Selecione a variação</option>{selected?.variants.map(variant => <option value={variant.id} key={variant.id}>{variant.color} / {variant.size} · {variant.sku}</option>)}</select></Field>
    <div className="ad-form-row"><Field label="Quantidade" type="number" inputMode="numeric" min="1" max="100000" step="1" value={qty} onChange={event => setQty(event.target.value)}/><Field label="Custo unitário (R$)" inputMode="decimal" value={cost} onChange={event => setCost(event.target.value)} placeholder="0,00"/></div>
    {itemError && <p className="ad-error" role="alert">{itemError}</p>}
    <Button type="button" kind="secondary" onClick={addItem}>Adicionar à compra</Button>
    <div className="purchase-edit-lines">{items.map((item,index) => {
      const product = products.find(product => product.id === item.productId);
      const variant = product?.variants.find(variant => variant.id === item.variantId);
      return <div className="purchase-edit-line" key={`${item.productId}-${item.variantId}`}><img src={productImage(product)} alt=""/><div><strong>{item.qty}× {product?.name || 'Roupa indisponível'}</strong><small>{variant?.color} / {variant?.size} · {money(item.unitCost)} cada</small><b>{money(item.qty*item.unitCost)}</b></div><button className="ad-icon" type="button" onClick={() => setItems(previous => previous.filter((_,itemIndex) => itemIndex !== index))} aria-label={`Remover ${product?.name || 'peça'} da compra`}>×</button></div>;
    })}</div>
    <div className="purchase-total"><span>Total da compra</span><strong>{money(total)}</strong></div>
    <Field label="Observações"><textarea rows={3} maxLength={2000} value={form.notes} onChange={change('notes')} placeholder="Referência do pedido, previsão de entrega ou outros detalhes"/></Field>
    <p className="purchase-help">Para uma roupa nova, cadastre o produto e suas variações antes de registrar a compra. Rascunhos também podem receber reposição.</p>
  </Form>;
}

function PurchaseDetail({purchase,products,onAction}) {
  return <div className="purchase-detail">
    <div className="purchase-detail-top"><div><span className="ad-overline">{purchase.number}</span><h3>{purchase.supplierName}</h3><p>Compra de {labelDate(purchase.date)} · {purchase.dueDate ? `Vence em ${labelDate(purchase.dueDate)}` : 'Vencimento não informado'}</p></div><strong>{money(purchase.total)}</strong></div>
    <div className="purchase-badges"><PurchaseStatus value={purchase.status}/><PurchaseStatus value={purchase.payment}/></div>
    <div className="ad-table-wrap"><AdminTable className="ad-table"><thead><tr><th>Roupa e variação</th><th>Quantidade</th><th>Custo unitário</th><th>Total</th></tr></thead><tbody>{purchase.items.map((item,index) => {
      const product = products.find(product => product.id === item.productId);
      const variant = product?.variants.find(variant => variant.id === item.variantId);
      return <tr key={index}><td><strong>{item.name || product?.name || 'Roupa do histórico'}</strong><small>{item.color || variant?.color} / {item.size || variant?.size}</small></td><td>{item.qty}</td><td>{money(item.unitCost)}</td><td><b>{money(item.qty*item.unitCost)}</b></td></tr>;
    })}</tbody></AdminTable></div>
    {purchase.notes && <p className="purchase-detail-notes">{purchase.notes}</p>}
    <dl className="purchase-history">{purchase.receivedAt && <div><dt>Recebimento registrado</dt><dd>{new Date(purchase.receivedAt).toLocaleString('pt-BR',{timeZone:'America/Manaus'})}</dd></div>}{purchase.paidAt && <div><dt>Pagamento registrado</dt><dd>{new Date(purchase.paidAt).toLocaleString('pt-BR',{timeZone:'America/Manaus'})}</dd></div>}</dl>
    <div className="purchase-detail-actions">{purchase.status === 'ordered' && <Button type="button" onClick={() => onAction('receive',purchase.id)}>Confirmar recebimento das peças</Button>}{purchase.payment === 'pending' && purchase.status !== 'canceled' && <Button type="button" kind="secondary" onClick={() => onAction('pay',purchase.id)}>Registrar pagamento realizado</Button>}{purchase.status === 'ordered' && purchase.payment === 'pending' && <Button type="button" kind="danger" onClick={() => onAction('cancel',purchase.id)}>Cancelar compra</Button>}</div>
  </div>;
}

function ConfirmPurchase({purchase,action,onSave}) {
  const [confirmed,setConfirmed] = useState(false);
  const texts = {
    receive:{label:'Confirmar recebimento',text:'Confira as quantidades entregues pelo fornecedor antes de confirmar. A entrada será registrada no estoque e o custo médio das roupas será atualizado.',check:'Conferi e recebi todas as peças desta compra.'},
    pay:{label:'Registrar pagamento',text:'Registre somente um pagamento que você já realizou fora do painel. Nenhum dinheiro será transferido pelo sistema.',check:'Confirmo que já paguei este valor ao fornecedor.'},
    cancel:{label:'Cancelar compra',text:'Esta compra deixará de compor os valores a pagar. Como as peças ainda não foram recebidas, o estoque não será alterado.',check:'Confirmo o cancelamento desta compra ainda não recebida.'}
  };
  const content = texts[action];
  return <Form label={content.label} onSubmit={() => {if (!confirmed) throw new Error('Marque a confirmação para continuar.');return onSave();}}><div className="purchase-confirm-summary"><span>{purchase.number} · {purchase.supplierName}</span><strong>{money(purchase.total)}</strong><small>{purchase.items.reduce((sum,item) => sum+item.qty,0)} peças</small></div><p className="purchase-help">{content.text}</p><label className="ad-checkbox"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} required/>{content.check}</label></Form>;
}

export default function Purchases() {
  const store = useStore();
  const {state,busy} = store;
  const suppliers = state.suppliers || [];
  const purchases = state.purchases || [];
  const products = state.products || [];
  const [tab,setTab] = useState('purchases');
  const [query,setQuery] = useState('');
  const [filter,setFilter] = useState('all');
  const [limit,setLimit] = useState(20);
  const [modal,setModal] = useState(null);
  const [notice,setNotice] = useState('');
  const today = localDate();
  const payable = purchases.filter(purchase => purchase.status !== 'canceled' && purchase.payment === 'pending');
  const overdue = payable.filter(purchase => purchase.dueDate && purchase.dueDate < today);
  const totalPayable = payable.reduce((sum,purchase) => sum+purchase.total,0);
  const search = normalize(query.trim());
  const filteredPurchases = (tab === 'payables' ? payable : purchases).filter(purchase => normalize(`${purchase.number} ${purchase.supplierName} ${purchase.notes || ''}`).includes(search) && (filter === 'all' || filter === purchase.status || filter === purchase.payment || filter === 'overdue' && purchase.dueDate && purchase.dueDate < today && purchase.payment === 'pending' && purchase.status !== 'canceled'));
  const filteredSuppliers = suppliers.filter(supplier => normalize(`${supplier.name} ${supplier.contact} ${supplier.email} ${supplier.phone}`).includes(search) && (filter === 'all' || filter === 'active' && supplier.active !== false || filter === 'inactive' && supplier.active === false));
  const activePurchase = modal?.purchaseId ? purchases.find(purchase => purchase.id === modal.purchaseId) : null;
  const activeSupplier = modal?.supplierId ? suppliers.find(supplier => supplier.id === modal.supplierId) : undefined;
  useEffect(() => {setLimit(20);},[tab,query,filter]);
  function go(next) {setTab(next);setQuery('');setFilter('all');setNotice('');}
  async function save(type,data,message) {await store.run(type,data);setModal(null);setNotice(message);}
  const supplierButton = <Button type="button" kind="secondary" onClick={() => setModal({type:'supplier'})}>Cadastrar fornecedor</Button>;
  const purchaseButton = <Button type="button" disabled={!suppliers.some(supplier => supplier.active !== false) || !products.some(product => product.status !== 'archived')} onClick={() => setModal({type:'purchase'})}>Nova compra</Button>;
  return <div className="purchase-app">
    <div className="purchase-metrics"><section><span>Valores a pagar</span><strong>{money(totalPayable)}</strong><small>{payable.length} compras em aberto</small></section><section className={overdue.length ? 'purchase-metric-alert' : ''}><span>Pagamentos vencidos</span><strong>{money(overdue.reduce((sum,purchase) => sum+purchase.total,0))}</strong><small>{overdue.length} compras com prazo vencido</small></section><section><span>Reposições aguardadas</span><strong>{purchases.filter(purchase => purchase.status === 'ordered').length}</strong><small>Receba as peças para atualizar o estoque</small></section></div>
    <div className="purchase-toolbar"><nav className="purchase-tabs" aria-label="Áreas de compras"><button aria-pressed={tab === 'purchases'} onClick={() => go('purchases')}>Compras</button><button aria-pressed={tab === 'payables'} onClick={() => go('payables')}>Contas a pagar</button><button aria-pressed={tab === 'suppliers'} onClick={() => go('suppliers')}>Fornecedores</button></nav><div className="purchase-toolbar-actions">{supplierButton}{purchaseButton}</div></div>
    {notice && <p className="purchase-success" role="status">✓ {notice}</p>}
    {!suppliers.some(supplier => supplier.active !== false) && <p className="purchase-guidance">Cadastre um fornecedor ativo para começar uma compra.</p>}
    {!products.some(product => product.status !== 'archived') && <p className="purchase-guidance">Cadastre as roupas e suas variações em Produtos antes de registrar uma reposição.</p>}
    <section className="ad-card"><div className="ad-filters"><label className="ad-search"><input value={query} onChange={event => setQuery(event.target.value)} placeholder={tab === 'suppliers' ? 'Buscar fornecedor ou contato' : 'Buscar compra ou fornecedor'} aria-label={tab === 'suppliers' ? 'Buscar fornecedor ou contato' : 'Buscar compra ou fornecedor'}/></label><select aria-label={tab === 'suppliers' ? 'Filtrar fornecedores' : 'Filtrar compras'} value={filter} onChange={event => setFilter(event.target.value)}>{tab === 'suppliers' ? <><option value="all">Todos os fornecedores</option><option value="active">Ativos</option><option value="inactive">Inativos</option></> : tab === 'payables' ? <><option value="all">Todos os valores a pagar</option><option value="overdue">Vencidos</option><option value="ordered">Aguardando peças</option><option value="received">Peças recebidas</option></> : <><option value="all">Todas as compras</option><option value="ordered">Aguardando entrega</option><option value="received">Recebidas</option><option value="pending">A pagar</option><option value="paid">Pagas</option><option value="canceled">Canceladas</option></>}</select></div>
      {tab === 'suppliers' ? <><div className="ad-table-wrap"><AdminTable className="ad-table"><thead><tr><th>Fornecedor</th><th>Contato</th><th>Telefone / e-mail</th><th>Situação</th><th>Ações</th></tr></thead><tbody>{filteredSuppliers.slice(0,limit).map(supplier => <tr key={supplier.id}><td><strong>{supplier.name}</strong></td><td>{supplier.contact || 'Não informado'}</td><td>{supplier.phone || 'Sem telefone'}<small>{supplier.email || 'Sem e-mail'}</small></td><td><span className={`purchase-state ${supplier.active !== false ? 'received' : 'canceled'}`}>{supplier.active !== false ? 'Ativo' : 'Inativo'}</span></td><td><Button type="button" kind="secondary" onClick={() => setModal({type:'supplier',supplierId:supplier.id})}>Editar fornecedor</Button></td></tr>)}</tbody></AdminTable></div>{!filteredSuppliers.length && <Empty title={suppliers.length ? 'Nenhum fornecedor encontrado' : 'Sua reposição começa pelo fornecedor'} text={suppliers.length ? 'Tente outro nome ou filtro.' : 'Guarde os contatos e acompanhe de quem você compra suas roupas.'}>{supplierButton}</Empty>}</> : <><div className="ad-table-wrap"><AdminTable className="ad-table"><thead><tr><th>Compra</th><th>Fornecedor</th><th>Entrega</th><th>Vencimento</th><th>Pagamento</th><th>Total</th><th>Ações</th></tr></thead><tbody>{filteredPurchases.slice(0,limit).map(purchase => {
        const isOverdue = purchase.payment === 'pending' && purchase.status !== 'canceled' && purchase.dueDate && purchase.dueDate < today;
        return <tr key={purchase.id}><td><button className="ad-order-number" onClick={() => setModal({type:'detail',purchaseId:purchase.id})}>{purchase.number}</button><small>{labelDate(purchase.date)} · {purchase.items.reduce((sum,item) => sum+item.qty,0)} peças</small></td><td><strong>{purchase.supplierName}</strong></td><td><PurchaseStatus value={purchase.status}/></td><td><span className={isOverdue ? 'purchase-overdue-text' : ''}>{purchase.dueDate ? labelDate(purchase.dueDate) : 'A combinar'}</span></td><td>{purchase.status === 'canceled' ? <span>Compra cancelada</span> : <PurchaseStatus value={purchase.payment} overdue={isOverdue}/>}</td><td><b>{money(purchase.total)}</b></td><td><Button type="button" kind="secondary" onClick={() => setModal({type:'detail',purchaseId:purchase.id})}>Ver compra</Button></td></tr>;
      })}</tbody></AdminTable></div>{!filteredPurchases.length && <Empty title={tab === 'payables' ? 'Nenhuma conta a pagar neste filtro' : 'Nenhuma compra encontrada'} text={purchases.length ? 'Tente outro termo ou filtro para consultar o histórico.' : 'Registre a reposição, receba as peças e acompanhe o prazo de pagamento.'}>{purchaseButton}</Empty>}</>}
      {(tab === 'suppliers' ? filteredSuppliers.length : filteredPurchases.length) > limit && <div className="purchase-load-more"><Button type="button" kind="secondary" onClick={() => setLimit(previous => previous+20)}>Mostrar mais registros</Button></div>}
    </section>
    <p className="purchase-footnote">Contas a pagar são compromissos com fornecedores. Registrar um pagamento não transfere dinheiro. O custo das peças entra no resultado quando elas são vendidas; a compra não é lançada novamente como despesa operacional.</p>
    {modal && <Modal title={modal.type === 'supplier' ? activeSupplier ? 'Editar fornecedor' : 'Novo fornecedor' : modal.type === 'purchase' ? 'Nova compra e reposição' : modal.type === 'detail' ? activePurchase?.number || 'Detalhes da compra' : modal.type === 'receive' ? 'Receber peças no estoque' : modal.type === 'pay' ? 'Registrar pagamento ao fornecedor' : 'Cancelar compra'} onClose={() => {if (!busy)setModal(null);}}>
      {modal.type === 'supplier' && <SupplierForm supplier={activeSupplier} onSave={data => save('suppliers.save',data,'Fornecedor salvo.')}/>}
      {modal.type === 'purchase' && <PurchaseForm suppliers={suppliers} products={products} onSave={data => save('purchases.save',data,'Compra registrada. Confirme o recebimento quando as peças chegarem.')}/>}
      {modal.type === 'detail' && activePurchase && <PurchaseDetail purchase={activePurchase} products={products} onAction={(type,purchaseId) => setModal({type,purchaseId})}/>}
      {['receive','pay','cancel'].includes(modal.type) && activePurchase && <ConfirmPurchase key={`${modal.type}-${activePurchase.id}`} purchase={activePurchase} action={modal.type} onSave={() => save(`purchases.${modal.type}`,{id:activePurchase.id},modal.type === 'receive' ? 'Recebimento confirmado. Estoque e custos atualizados.' : modal.type === 'pay' ? 'Pagamento registrado no histórico da compra.' : 'Compra cancelada.')}/>}
    </Modal>}
  </div>;
}
