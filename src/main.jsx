import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Admin from './admin.jsx';
import Storefront from './Storefront.jsx';
import AdminLogin from './AdminLogin.jsx';
import { StoreProvider, useStore } from './store.jsx';

function Router() {
  const [admin,setAdmin] = useState(location.hash.startsWith('#/admin') || new URLSearchParams(location.search).get('admin')==='1');
  const store = useStore();
  useEffect(() => { const change=()=>setAdmin(location.hash.startsWith('#/admin')); window.addEventListener('hashchange',change); return()=>window.removeEventListener('hashchange',change); },[]);
  useEffect(() => { document.title=admin?'Griff Casual — Painel administrativo':'Griff Casual — Vista sua atitude.'; window.scrollTo(0,0); },[admin]);
  if(store.loading || store.error && !store.state) return <Admin/>;
  return admin ? (!store.demo && !store.user ? <AdminLogin/> : <Admin/>) : <Storefront/>;
}
createRoot(document.getElementById('root')).render(<StoreProvider><Router/></StoreProvider>);
