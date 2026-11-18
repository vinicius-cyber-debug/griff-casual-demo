import React from 'react';
import {money} from './shop.js';
import {productImage} from './domain.js';

export default function StorePromotions({products,onChoose}) {
  if(!products.length)return null;
  return <section id="ofertas" className="store-promotions section" aria-labelledby="offers-title"><div className="section-heading"><div><span className="eyebrow muted">SEU LOOK, UMA OPORTUNIDADE A MAIS</span><h2 id="offers-title">OFERTAS DA GRIFF<span className="green-period">.</span></h2></div><span className="catalog-note">Desconto aplicado nas peças<br/>durante a promoção.</span></div><div className="store-offer-grid">{products.map(p=><article className="store-offer" key={p.id}><button className="store-offer-photo" onClick={()=>onChoose(p)} aria-label={`Ver oferta ${p.name}`}><img src={productImage(p)} alt={p.alt} loading="lazy"/><span>− {money(p.originalPrice-p.price)}</span></button><div><small>{p.promotionName}</small><h3>{p.name}</h3><div className="offer-prices"><del>{money(p.originalPrice)}</del><strong>{money(p.price)}</strong></div><button className="text-link" onClick={()=>onChoose(p)}>ESCOLHER TAMANHO <span aria-hidden="true">↗</span></button></div></article>)}</div></section>;
}
