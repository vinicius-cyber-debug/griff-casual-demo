import * as esbuild from 'esbuild';
import {mkdir} from 'node:fs/promises';
await mkdir('work', {recursive:true});
await esbuild.build({entryPoints:['supabase/functions/griff-admin/index.ts'],bundle:true,format:'esm',platform:'neutral',target:'es2022',external:['npm:*'],outfile:'work/griff-admin-edge.js',minify:false,logLevel:'info'});
