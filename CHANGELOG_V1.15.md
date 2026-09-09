# AgendAI v1.15 — Produtos físicos, estoque e vitrine pública

## Produtos separados de serviços
- Novo módulo **Produtos** no painel administrativo.
- Cadastro independente de produtos físicos, sem misturar com o catálogo de serviços.
- Campos de nome, descrição, preço, custo, estoque, categoria, SKU/código, foto por URL, status e visibilidade pública.
- Permissão específica **Produtos & vendas** para usuários da equipe.

## Venda no app
- Tela de **Venda rápida** com carrinho.
- Baixa automática de estoque ao concluir venda interna.
- Pagamentos por Pix, dinheiro, crédito e débito.
- Histórico de vendas de produtos separado dos agendamentos.
- Pedidos públicos podem ser concluídos ou cancelados; cancelamento devolve itens reservados ao estoque.

## Site público
- A página do cliente agora separa claramente **Agendar serviços** e **Comprar produtos**.
- Vitrine com foto, categoria, descrição, preço e disponibilidade.
- Carrinho com quantidade limitada ao estoque atual.
- Pedido público exige nome e WhatsApp, entra como pendente e reserva estoque.
- Após o pedido, o WhatsApp do estabelecimento é aberto com o resumo da compra.
- Dados internos como custo/margem dos produtos nunca são enviados pela API pública.

## Caixa e relatórios
- Vendas concluídas de produtos entram no faturamento do dia.
- Pix, cartão e dinheiro passam a considerar serviços + produtos.
- Comissões continuam vinculadas somente aos serviços/barbeiros.
- Relatórios e fechamento mostram separadamente serviços e vendas de produtos.

## Sincronização e segurança
- Produtos e vendas são sincronizados no mesmo armazenamento do estabelecimento.
- Endpoint público `/api/product-order` valida produto, preço e estoque no servidor; não confia no valor enviado pelo navegador.
- Pedidos geram notificação no sino do estabelecimento, isolada pelo `org_id`.
- Não há nova tabela D1 nesta versão.
