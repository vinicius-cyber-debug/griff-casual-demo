import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
import { applyCommand, BusinessError, emptyState, seedProducts } from '../../../src/domain.js';

const origins = new Set(['https://vinicius-cyber-debug.github.io', 'http://127.0.0.1:5173', 'http://localhost:5173']);
function headersFor(request) { const origin = request.headers.get('origin'); return { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Vary': 'Origin', ...(origin && origins.has(origin) ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-griff-admin', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Max-Age': '600' } : {}) }; }
function json(request, value, status = 200) { return new Response(JSON.stringify(value), { status, headers: headersFor(request) }); }
function adminClient() { const url = Deno.env.get('SUPABASE_URL'); const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'); if (!url || !key) throw new Error('Backend configuration unavailable'); return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }); }
async function snapshot(db) { const {data,error} = await db.from('griff_state').select('version,data').eq('id',1).single(); if (error) throw new Error('Database unavailable'); return {version:Number(data.version),state:data.data}; }
async function authorized(request,db) { const bearer=request.headers.get('authorization')||'';if(!bearer.startsWith('Bearer ')) return {error:'Entre com sua conta para acessar o painel.',status:401};const {data,error}=await db.auth.getUser(bearer.slice(7));const user=data?.user;if(error||!user?.email||!user.email_confirmed_at)return {error:'Sua sessão expirou. Entre novamente.',status:401};const {data:admin,error:adminError}=await db.from('griff_admin_emails').select('email').eq('email',user.email.toLowerCase()).maybeSingle();if(adminError||!admin)return {error:'Esta conta não está autorizada a administrar a Griff Casual.',status:403};return {user:{id:user.id,email:user.email,name:user.user_metadata?.name||user.email}};}
function publicCatalog(state) { return { products: state.products.filter(p=>p.status==='active').map(p=>({id:p.id,name:p.name,sku:p.sku,category:p.category,collection:p.collection,description:p.description,price:p.price,compareAt:p.compareAt,status:p.status,badge:p.badge,images:p.images,alt:p.alt,colors:p.colors,sizes:p.sizes,variants:p.variants.map(v=>({id:v.id,size:v.size,color:v.color,sku:v.sku,stock:Math.min(10,v.stock)}))})), settings:{name:state.settings.name,instagram:state.settings.instagram}, promotions:(state.promotions||[]).filter(p=>p.active).map(p=>({id:p.id,name:p.name,productIds:p.productIds,kind:p.kind,value:p.value,start:p.start,end:p.end,active:true})), banners:(state.banners||[]).filter(b=>b.active).map(b=>({id:b.id,title:b.title,subtitle:b.subtitle,eyebrow:b.eyebrow,buttonText:b.buttonText,target:b.target,image:b.image,active:true,position:b.position})) }; }
export async function handler(request) {
  const origin=request.headers.get('origin');if(origin&&!origins.has(origin))return json(request,{error:'Origem não autorizada.'},403);if(request.method==='OPTIONS')return new Response(null,{status:204,headers:headersFor(request)});
  try {
    const db=adminClient();const route=new URL(request.url).pathname.split('/').filter(Boolean).pop();
    if(route==='health'&&request.method==='GET')return json(request,{ok:true,version:'2.2.0',features:['pos.checkout','commerce','public-marketing']});
    if(route==='catalog'&&request.method==='GET'){const current=await snapshot(db);return json(request,publicCatalog(current.state));}
    const auth=await authorized(request,db);if(auth.error)return json(request,{error:auth.error},auth.status);
    if(route==='session'&&request.method==='GET')return json(request,{user:auth.user});
    if(route==='state'&&request.method==='GET')return json(request,await snapshot(db));
    if(route==='commands'&&request.method==='POST'){
      const raw=await request.text();if(raw.length>500000)return json(request,{error:'A operação excedeu o limite de tamanho.'},413);let command;try{command=JSON.parse(raw);}catch{return json(request,{error:'Dados inválidos.'},400);}const current=await snapshot(db);
      if(current.state.appliedCommands.includes(command.id))return json(request,current);
      if(!Number.isSafeInteger(command.expectedVersion)||command.expectedVersion!==current.version)return json(request,{error:'Os dados mudaram em outra sessão. Atualize o painel e tente novamente.'},409);
      if(command.type==='media.add'||command.type==='products.save'||command.type==='banners.save'){const images=command.type==='media.add'?(command.data?.media||[]).map(m=>m.url):command.type==='banners.save'?(command.data?.image?[command.data.image]:[]):(command.data?.images||[]);const project=Deno.env.get('SUPABASE_URL');if(images.some(url=>typeof url!=='string'||(!url.startsWith('images/')&&!url.startsWith(`${project}/storage/v1/object/public/griff-products/`))))return json(request,{error:'Envie as imagens para o armazenamento desta loja.'},400);}
      const next=applyCommand(current.state,command,{actor:auth.user.email,demo:false});
      const {data,error}=await db.rpc('griff_compare_and_swap',{p_expected_version:current.version,p_next_state:next});
      if(error){if(error.code==='40001')return json(request,{error:'Os dados mudaram em outra sessão. Atualize o painel e tente novamente.'},409);throw new Error('Unable to persist');}return json(request,data);
    }
    if(route==='media'&&request.method==='POST'){
      if(Number(request.headers.get('content-length')||0)>1700000)return json(request,{error:'Imagem muito grande.'},413);
      const form=await request.formData();const file=form.get('image');if(!(file instanceof File)||file.size>1500000||file.size<12)return json(request,{error:'Envie uma imagem válida de até 1,5 MB após a otimização.'},400);
      const bytes=new Uint8Array(await file.arrayBuffer());let ext;let mime;if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255){ext='jpg';mime='image/jpeg';}else if(bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71){ext='png';mime='image/png';}else if(String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP'){ext='webp';mime='image/webp';}else return json(request,{error:'Use imagens JPG, PNG ou WebP.'},400);
      const key=`${crypto.randomUUID()}.${ext}`;const {error}=await db.storage.from('griff-products').upload(key,bytes,{contentType:mime,cacheControl:'31536000',upsert:false});if(error)throw new Error('Upload failed');const {data}=db.storage.from('griff-products').getPublicUrl(key);return json(request,{url:data.publicUrl});
    }
    return json(request,{error:'Rota não encontrada.'},404);
  } catch(error) {if(error instanceof BusinessError)return json(request,{error:error.message},400);console.error('Griff backend operation failed',error?.message);return json(request,{error:'Não foi possível concluir a operação. Tente novamente ou contate o responsável pela loja.'},500);}
}
Deno.serve(handler);
