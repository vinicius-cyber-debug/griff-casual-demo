import React,{useState} from 'react';

export default function HeroBanners({banners=[],onBrowse,onOffers,children}) {
  const [index,setIndex]=useState(0);
  const active=banners.filter(b=>b.active).sort((a,b)=>a.position-b.position||a.id.localeCompare(b.id));
  if(!active.length)return children;
  const current=active[index%active.length];
  return <section className="hero configurable-hero" aria-roledescription="carrossel" aria-label="Destaques da Griff"><div className="custom-hero-image">{current.image&&<img src={current.image} alt="" fetchPriority="high"/>}</div><div className="custom-hero-shade"/><div className="hero-inner"><div className="eyebrow"><span className="green-dash"/>{current.eyebrow||'GRIFF CASUAL / STREETWEAR'}</div><h1>{current.title}</h1><p>{current.subtitle}</p><button className="button green" onClick={current.target==='promotions'?onOffers:onBrowse}>{current.buttonText||'EXPLORAR O DROP'} <span aria-hidden="true">↗</span></button><div className="hero-bottom"><span>GRIFF CASUAL</span><span>VISTA SUA ATITUDE.</span></div>{active.length>1&&<div className="banner-controls" aria-label="Escolher destaque"><button onClick={()=>setIndex(i=>(i+active.length-1)%active.length)} aria-label="Banner anterior">←</button><span aria-live="polite">{index%active.length+1} / {active.length}</span><button onClick={()=>setIndex(i=>(i+1)%active.length)} aria-label="Próximo banner">→</button></div>}</div></section>;
}
