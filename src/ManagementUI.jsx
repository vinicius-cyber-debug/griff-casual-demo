import React, {useEffect,useRef,useState} from 'react';
import {useStore} from './store.jsx';

export function Button({children,kind='primary',...props}) {return <button className={`ad-button ${kind}`} {...props}>{children}</button>;}
export function Field({label,hint,children,...props}) {return <label className="ad-field"><span>{label}</span>{children || <input {...props}/>} {hint && <small>{hint}</small>}</label>;}
export function Modal({title,onClose,children}) {
  const ref=useRef(null);
  useEffect(()=>{ref.current.showModal();const old=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=old;};},[]);
  return <dialog ref={ref} className="ad-modal wide" aria-labelledby="management-modal-title" onCancel={e=>{e.preventDefault();onClose();}}><div className="ad-modal-head"><h2 id="management-modal-title">{title}</h2><button className="ad-icon" aria-label="Fechar janela" onClick={onClose} type="button">×</button></div><div className="ad-modal-content">{children}</div></dialog>;
}
export function Form({children,onSubmit,label='Salvar',busy:extraBusy=false}) {
  const {busy}=useStore();const [error,setError]=useState('');const lock=useRef(false);
  return <form className="ad-form" onSubmit={async e=>{e.preventDefault();if(lock.current)return;lock.current=true;setError('');try{await onSubmit();}catch(e){setError(e.message);}finally{lock.current=false;}}}>{children}{error && <p className="ad-error" role="alert">{error}</p>}<div className="ad-form-footer"><span>Confira os dados antes de confirmar.</span><Button type="submit" disabled={busy||extraBusy}>{busy||extraBusy?'Salvando…':label}</Button></div></form>;
}
