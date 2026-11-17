import {emptyState,seedProducts} from '../src/domain.js';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const state=emptyState();state.products=seedProducts();
const seed=`-- Initial illustrative catalog only. No orders or customer information.\ninsert into public.griff_state (id, version, data) values (1, 0, '${JSON.stringify(state).replaceAll("'","''")}'::jsonb) on conflict (id) do nothing;\n`;
await writeFile('supabase/seed.sql',seed);
await mkdir('work',{recursive:true});
await writeFile('work/setup.sql',`begin;\n${await readFile('supabase/migrations/202611170001_griff_admin.sql','utf8')}\n${seed}\ncommit;\nselect id,version,jsonb_array_length(data->'products') as products from public.griff_state;\n`);
console.log('Schema and initial catalog prepared. Administrator emails must be added privately through the Supabase dashboard.');
