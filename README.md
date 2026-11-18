# Griff Casual — loja e painel administrativo

Vitrine streetwear em React, com painel administrativo, Supabase Auth, PostgreSQL e Supabase Storage.

- Vitrine: https://vinicius-cyber-debug.github.io/griff-casual-demo/
- Administração com login: https://vinicius-cyber-debug.github.io/griff-casual-demo/#/admin
- Painel de demonstração: https://vinicius-cyber-debug.github.io/griff-casual-demo/?demo=1#/admin

## Recursos

- Cadastro, edição, duplicação e arquivamento de roupas.
- Até cinco fotos por roupa; otimização de imagens e biblioteca reutilizável.
- Categorias e variações de tamanho/cor com SKU, estoque, custo, preço e preço anterior.
- Entradas e saídas de estoque, alertas e histórico de movimentações.
- Pedidos manuais com reserva de estoque, pagamento, preparação, envio, entrega, cancelamento e devolução.
- Clientes e histórico de pedidos; cupons percentuais ou fixos com validade e limites.
- Despesas, receita recebida, ticket médio, resultado estimado e ranking de produtos.
- Exportação CSV e JSON, configurações da loja e registro das últimas alterações.
- Busca, favoritos e sacola na vitrine; produtos ativos são lidos do catálogo público do Supabase.

## Acesso real e demonstração

O endereço normal usa o Supabase. A administração exige um link de acesso enviado pelo Supabase ao e-mail autorizado. O login é conferido novamente no servidor e o e-mail precisa constar na tabela privada `griff_admin_emails`.

O parâmetro `?demo=1` abre uma demonstração isolada, com dados fictícios no IndexedDB do navegador. Ela não modifica o banco real. Não cadastre dados pessoais reais na demonstração.

O catálogo inicial tem oito produtos ilustrativos, preservando a vitrine original. No ambiente real, pedidos, clientes, cupons e despesas começam vazios. Substitua fotos, descrições, tamanhos, custos e preços antes de operar uma loja real.

## Rodar localmente

Requer Node.js 22.12 ou superior e npm:

```sh
npm install
npm run dev
```

Abra a URL exibida no terminal. Para testar o painel sem uma conta administrativa, acrescente `?demo=1#/admin`. Para verificar as regras de negócio, execute `npm test`.

```sh
npm run build:pages
npm run build:function
```

A primeira tarefa gera `docs/`, publicada pelo GitHub Pages a partir de `main` e `/docs`. A segunda gera `work/griff-admin-edge.js`, a função única para publicar no editor do Supabase. `npm run build` gera `dist/` para outra hospedagem estática.

## Configuração do Supabase

O projeto em uso está identificado em `public/runtime.js`. A chave `sb_publishable_…` é uma chave pública de conexão; ela não dá acesso aos registros administrativos. Nunca coloque senha do banco, chave secreta, token de usuário ou chave de serviço no frontend ou no GitHub.

Para reproduzir em outro projeto:

1. Aplique os arquivos de `supabase/migrations/` na ordem indicada pelos nomes.
2. Aplique `supabase/seed.sql` somente para iniciar o catálogo ilustrativo. O comando não sobrescreve uma loja já existente.
3. Cadastre privadamente o e-mail do administrador, substituindo o exemplo abaixo no SQL Editor:

```sql
insert into public.griff_admin_emails(email)
values ('administrador@exemplo.com')
on conflict (email) do nothing;
```

4. Publique a função `griff-admin` com o arquivo gerado por `npm run build:function`. Ela usa as variáveis de servidor `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`, fornecidas pelo ambiente do Supabase. O handler valida cada sessão com `auth.getUser()` e consulta a lista privada de administradores.
5. A configuração `verify_jwt = false` evita a validação antiga limitada ao segredo legado do gateway; a validação dos JWTs atuais permanece obrigatória dentro da função. O catálogo público utiliza uma função SQL separada, que retorna somente campos próprios para a vitrine.
6. Configure a Site URL para o endereço final da vitrine e permita o retorno `https://SEU-ENDERECO/?admin=1` em Authentication > URL Configuration.
7. Atualize `public/runtime.js` e a lista de origens permitidas da Edge Function para a nova hospedagem; gere e publique novamente o frontend.

As tabelas administrativas têm RLS e nenhum acesso direto de `anon` ou `authenticated`. A função SQL pública não retorna clientes, pedidos, custos, despesas ou atividade. Somente fotos de produtos ficam públicas no bucket `griff-products`; o envio é autorizado no backend. Os arquivos aceitos são JPG, PNG e WebP, limitados a 1,5 MB após otimização.

## Como o estoque e as vendas funcionam

### Promoções, compras, clientes e marketing

- **Promoções:** seleção de roupas, desconto percentual ou em reais por peça e vigência pelo calendário de Manaus. Entre ofertas simultâneas, aplica-se o menor preço; o preço mínimo é R$ 0,01. Cupons podem ser aplicados sobre o preço promocional. Vitrine, sacola, WhatsApp e PDV usam o preço efetivo, e o servidor refaz a conta antes de registrar a venda. O preço base e os custos de vendas antigas são preservados.
- **Peças paradas:** estoque disponível sem venda paga válida há 30/60/90/180 dias. Sem venda anterior, usa a data do cadastro ou da última entrada. Exclui estoque zero e arquivados; não representa idade individual de lotes.
- **Compras e fornecedores:** cadastro de fornecedor, compra por variação, recebimento e pagamento manual separados. Receber soma estoque e recalcula custo médio ponderado; repetir a confirmação não duplica entrada. Compras recebidas não são editadas/canceladas, e uma compra paga não pode ser cancelada. Não há recebimento parcial ou estorno de compra nesta versão. Valores a pagar são separados de despesas operacionais, pois o custo das peças já entra no resultado quando vendidas.
- **Histórico do cliente:** pedidos vinculados pelo ID do cadastro, valores recebidos, ticket, última compra e tamanhos. Nome ou e-mail iguais não associam compras automaticamente. Selecione o cliente no PDV para vincular a venda.
- **Marketing:** calendário de campanhas, canal, peças, mensagem e anotações internas. O texto pode ser gerado a partir dos preços atuais, copiado ou exportado. Publicação e envio são manuais; não há anúncios pagos ou disparos automáticos.
- **Banners:** até cinco ativos, com imagem enviada para o Storage ou escolhida da biblioteca, textos, botão, destino e ordem. O carrossel é controlado por setas; sem banners ativos, permanece a apresentação original.

Dados legados recebem as novas coleções na próxima alteração, sem apagar o catálogo ou os pedidos. O endpoint público `GET /functions/v1/griff-admin/catalog` expõe somente catálogo, promoções, banners e nome/Instagram da loja; o frontend atual usa esse endpoint. A RPC SQL anterior continua disponível para compatibilidade. Compras, fornecedores, campanhas internas e clientes permanecem privados.

### PDV e uso pelo celular

Abra `#/admin/pdv` ou toque em **PDV** na navegação inferior. Busque pelo nome, SKU do produto ou SKU da variação; escolha tamanho e cor; confira a sacola. O cliente é opcional: sem identificação, a venda usa “Cliente balcão” e não cria um contato na agenda. Cupons usam as mesmas regras do painel. Escolha Pix, cartão ou dinheiro; para dinheiro, informe o valor recebido e confira o troco.

O operador deve confirmar que recebeu o pagamento fora do sistema e entregou as peças. A operação `pos.checkout` registra pagamento, entrega, baixa de estoque e histórico na mesma transação. O servidor confere preços, estoque, cupom, total e recebimento em dinheiro. Uma referência única impede repetir a mesma venda, mesmo depois de reconectar com outro identificador de comando. Uma resposta incerta bloqueia mudanças na venda até verificar o registro. A sacola e uma eventual tentativa pendente ficam no `sessionStorage` daquela aba; mantenha-a aberta até confirmar o resultado. O PDV real exige conexão com a internet.

O resumo pode ser impresso ou salvo como PDF pelo navegador e reimpresso nos detalhes do pedido. Ele não é nota fiscal. Não há cobrança de Pix/cartão, integração com maquininha, emissão fiscal ou gestão de abertura e fechamento de caixa. Registre taxas e despesas no financeiro.

No celular, Início, PDV, Produtos e Pedidos ficam na barra inferior; **Mais** abre todas as opções. Tabelas viram cartões com rótulos, formulários têm campos maiores e o PDV separa escolha de peças e conferência da sacola. A vitrine também tem alvos de toque maiores. A demonstração `?demo=1#/admin/pdv` usa dados locais; o modo **CONEXÃO SEGURA** usa a conta administradora e o banco da loja.

Criar um pedido reserva o estoque imediatamente. O cancelamento de um pedido pendente devolve as peças uma única vez. Pedidos pagos precisam de registro de estorno/devolução. O operador escolhe se as peças voltam ao estoque. Tamanhos e cores de uma variação com histórico não podem ser reaproveitados; crie uma variação nova.

Os preços do pedido são definidos pelo servidor a partir do catálogo e ficam registrados no histórico, mesmo depois de editar o produto. As atualizações usam uma versão do banco e uma transação para impedir perda de alterações simultâneas e venda com estoque negativo. Após conflito, atualize os dados e revise a operação.

O envio de foto é independente do cadastro: uma foto enviada pode continuar na biblioteca mesmo se o formulário da roupa for cancelado.

## Limites operacionais

- Pagamentos e estornos são registros manuais de operações realizadas fora do sistema. O painel não cobra cartões nem movimenta dinheiro.
- O checkout público abre o WhatsApp com peças, tamanhos, cores, quantidades, subtotal, nome opcional e preferência de recebimento. O cliente precisa enviar a mensagem. A abertura não registra venda, reserva estoque ou confirma pagamento. Após combinar com o cliente, o operador cadastra a venda no painel. O catálogo inicial continua ilustrativo; substitua os produtos e preços antes da operação comercial. Não há emissão de nota fiscal, integração de transportadoras ou conciliação bancária.
- O resultado financeiro é uma estimativa: receita paga menos frete, custo das peças vendidas e despesas cadastradas. Cadastre taxas e impostos como despesas. Estornos deixam de compor a receita paga.
- A versão foi feita para uma loja pequena: até 1.000 produtos, 5.000 pedidos e um documento de dados de até 8 MB. Os últimos 500 eventos de atividade e 2.000 movimentos de estoque ficam no painel. Para maior volume, migre os registros para tabelas normalizadas e mantenha um histórico completo separado.
- Exportar JSON salva os dados e as referências das fotos; mantenha cópia dos arquivos do Storage separadamente. Não há restauração automática de backups nesta versão.
- A atualização do catálogo aparece na próxima leitura da vitrine. Use o botão Atualizar dados no painel para buscar alterações de outra sessão.
- O envio de links de login está sujeito aos limites de e-mail do Supabase. Para operação comercial, configure seu próprio SMTP e acompanhe as cotas do plano.

## WhatsApp do checkout

O destino público está em `public/runtime.js`, na propriedade `checkoutWhatsApp`, atualmente `+55 92 98520-7901`. Para trocar, edite esse valor, execute `npm run build:pages` e publique no GitHub. O campo Telefone de contato nas configurações administrativas permanece como contato interno: o catálogo público atual do Supabase não expõe esse campo. A edição do destino do checkout diretamente pelo painel exige atualizar essa projeção pública no banco; não é necessário para o checkout atual.

O link usa `wa.me` com mensagem codificada. O subtotal vem dos preços e variantes disponíveis no catálogo carregado, nunca dos preços gravados na sacola. Frete e valor final são confirmados pela loja. Nome e observações ficam na memória da página até o cliente abrir o WhatsApp; a sacola continua salva no navegador. A mensagem é um pedido de atendimento, não comprovante de compra ou pagamento.

## Identidade e fotografias

A imagem `public/images/griff-original.jpg` foi fornecida pelo usuário e preservada. Ela tem 150 × 150 pixels; substitua por uma versão maior quando disponível. As fotografias ilustrativas vêm do Unsplash; as origens estão em `scripts/fetch-images.mjs`.

A ideia inicial veio do projeto [MERN-Stack-eCommerce-App, de ahmedsemih](https://github.com/ahmedsemih/MERN-Stack-eCommerce-App). Esta implementação foi criada do zero; o backend desta versão utiliza Supabase.
