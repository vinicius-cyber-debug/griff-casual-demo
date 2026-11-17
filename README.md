# Griff Casual — vitrine streetwear

Primeira versão em React da loja Griff Casual, com verde, preto e a imagem original enviada pelo responsável pela marca. Instagram: https://www.instagram.com/griff.casual/

## Rodar no computador

Requer Node.js 22.12 ou superior e npm.

```sh
npm install
npm run dev
```

Abra a URL exibida no terminal. Para gerar os arquivos de publicação: `npm run build`. Para verificar a lógica de busca e sacola: `npm test`.

## O que funciona

- Layout para celular e computador, catálogo por categoria e ordenação por preço.
- Busca por nome, categoria ou coleção, com tratamento de acentos.
- Favoritos e sacola persistidos no navegador.
- Escolha de tamanho, quantidades de 1 a 10 por tamanho, remoção e subtotal em reais.
- Resumo demonstrativo da compra e link para o Instagram.
- Navegação por teclado, modais nativos, foco visível e suporte à preferência por movimentos reduzidos.

## Como colocar seus produtos

Edite `src/shop.js`. Os preços são inteiros em centavos: `8990` significa R$ 89,90. As fotos ficam em `public/images/`. Troque as fotos e também atualize as descrições e textos alternativos. A imagem `griff-original.jpg` foi fornecida pelo usuário e foi preservada sem alterações.

As fotografias de catálogo e do banner são ilustrativas, obtidas no Unsplash. As origens estão em `scripts/fetch-images.mjs`. Substitua as fotografias ilustrativas por imagens dos seus produtos antes de vender. As amostras de cores são ilustrativas; nesta versão, apenas o tamanho define a variante da sacola. O arquivo original da marca tem 150 × 150 pixels: substitua por uma versão em alta resolução quando disponível.

## Limites desta primeira versão

Esta é uma vitrine funcional com dados demonstrativos. Não existem pagamentos, frete calculado, pedidos reais, autenticação, servidor, banco de dados, painel administrativo ou validação de estoque. Nada é enviado ao Instagram automaticamente. Favoritos e sacola ficam somente no navegador. Preços, nomes, tamanhos, coleções e textos institucionais são propostas e precisam ser confirmados pela marca.

Para operar uma loja, será necessário cadastrar o catálogo real, integrar o backend, implementar controle de estoque, escolher pagamento e frete, e preencher as informações comerciais e políticas da empresa. Não cadastre dados pessoais nem credenciais neste frontend.

## Referência

Ideia baseada no projeto [MERN-Stack-eCommerce-App, de ahmedsemih](https://github.com/ahmedsemih/MERN-Stack-eCommerce-App), que utiliza React, Express, Node.js e MongoDB. Esta implementação visual foi criada do zero e não copia o backend nem o código do repositório. O frontend React pode futuramente consumir uma API MERN. Não requer conta MongoDB para esta demonstração.

## Demonstração no GitHub Pages

- Site: https://vinicius-cyber-debug.github.io/griff-casual-demo/
- Código: https://github.com/vinicius-cyber-debug/griff-casual-demo

A demonstração é pública e não realiza vendas. A pasta `docs/` contém a versão compilada publicada pelo GitHub Pages, com os caminhos preparados para funcionar em `/griff-casual-demo/`.

Depois de editar produtos ou layout, execute `npm run build:pages` e envie as alterações do código e de `docs/` ao repositório. Nas configurações do GitHub Pages, use `Deploy from a branch`, branch `main` e pasta `/docs`. Não é necessário configurar segredos ou serviços pagos. Para outras hospedagens estáticas, `npm run build` gera `dist/`.
