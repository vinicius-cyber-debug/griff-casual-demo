import { mkdir, writeFile } from 'node:fs/promises';
const assets = {
  hero: 'photo-1488161628813-04466f872be2',
  'tee-black': 'photo-1583743814966-8936f5b7be1a',
  hoodie: 'photo-1556821840-3a63f95609a7',
  'tee-white': 'photo-1521572163474-6864f9cf17ab',
  cargo: 'photo-1473966968600-fa801b869a1a',
  'tee-green': 'photo-1503341504253-dff4815485f1',
  cap: 'photo-1588850561407-ed78c282e89b',
  jacket: 'photo-1544022613-e87ca75a784a',
  'tee-sand': 'photo-1503342217505-b0a15ec3261c'
};
await mkdir('public/images', { recursive: true });
await Promise.all(Object.entries(assets).map(async ([name, photo]) => {
  const url = `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=${name === 'hero' ? 1600 : 750}&q=85`;
  const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error(`${name}: ${response.status}`);
  await writeFile(`public/images/${name}.jpg`, Buffer.from(await response.arrayBuffer()));
  console.log(`Saved ${name}`);
}));
