-- Expose only storefront fields. Customer records, sales, cost and activity stay private.
create or replace function public.griff_public_catalog()
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
select jsonb_build_object(
 'products', coalesce((select jsonb_agg(jsonb_build_object(
  'id', p->'id', 'name', p->'name', 'sku', p->'sku', 'category', p->'category',
  'collection', p->'collection', 'description', p->'description', 'price', p->'price',
  'compareAt', p->'compareAt', 'status', p->'status', 'badge', p->'badge',
  'images', p->'images', 'alt', p->'alt', 'colors', p->'colors', 'sizes', p->'sizes',
  'variants', coalesce((select jsonb_agg(jsonb_build_object('id', v->'id', 'size', v->'size',
    'color', v->'color', 'sku', v->'sku', 'stock', least(10, greatest(0, (v->>'stock')::integer))))
    from jsonb_array_elements(p->'variants') v), '[]'::jsonb)
 )) from jsonb_array_elements(s.data->'products') p where p->>'status' = 'active'), '[]'::jsonb),
 'settings', jsonb_build_object('name', s.data->'settings'->'name', 'instagram', s.data->'settings'->'instagram')
) from public.griff_state s where s.id = 1;
$$;
revoke all on function public.griff_public_catalog() from public;
grant execute on function public.griff_public_catalog() to anon, authenticated, service_role;
