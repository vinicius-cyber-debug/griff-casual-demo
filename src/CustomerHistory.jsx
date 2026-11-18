import React from 'react';
import {useStore} from './store.jsx';
import {customerHistory} from './commerce.js';
import {dateLabel,statusLabels} from './domain.js';
import {money} from './shop.js';
import AdminTable from './AdminTable.jsx';

export default function CustomerHistory({customerId,onOpenOrder}) {
  const {state}=useStore();const history=customerHistory(state,customerId);
  if(!history.customer)return <p>Cliente não encontrado.</p>;
  return <div className="customer-history"><div className="ad-order-customer"><h3>{history.customer.name}</h3><p>{[history.customer.email,history.customer.phone].filter(Boolean).join(' · ')||'Contato não informado'}</p><p>{history.customer.notes}</p></div><div className="customer-history-metrics"><div><span>Total recebido</span><strong>{money(history.totalSpent)}</strong></div><div><span>Compras pagas</span><strong>{history.paidCount}</strong></div><div><span>Ticket médio</span><strong>{money(history.average)}</strong></div><div><span>Última compra paga</span><strong>{history.lastPurchase?dateLabel(history.lastPurchase):'—'}</strong></div></div><div className="ad-tip"><p>Somente pedidos vinculados a este cadastro entram no histórico. No PDV, selecione o cliente antes de concluir. Pedidos cancelados ou estornados não compõem o total recebido.</p></div>{history.sizes.length>0&&<p className="customer-sizes">Tamanhos comprados: {history.sizes.map(row=>`${row.size} (${row.qty} peças)`).join(' · ')}</p>}<div className="ad-table-wrap"><AdminTable className="ad-table"><thead><tr><th>Pedido</th><th>Data</th><th>Peças</th><th>Situação</th><th>Total</th></tr></thead><tbody>{history.orders.map(order=><tr key={order.id}><td><button className="ad-text-button" onClick={()=>onOpenOrder(order.id)}>{order.number} →</button></td><td>{dateLabel(order.createdAt)}</td><td>{order.items.map((item,index)=><small key={index}>{item.qty}× {item.name} · {item.color}/{item.size}</small>)}</td><td>{statusLabels[order.payment]}<small>{statusLabels[order.status]}</small></td><td>{money(order.total)}</td></tr>)}</tbody></AdminTable>{!history.orders.length&&<div className="ad-empty"><h3>O histórico começa na próxima compra.</h3><p>Selecione este cliente no PDV ou no cadastro do pedido para vincular o atendimento.</p></div>}</div></div>;
}
