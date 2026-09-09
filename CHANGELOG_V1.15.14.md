# AgendAI v1.15.14 — proteção antiabuso no site público

## Segurança
- Adicionada verificação Cloudflare Turnstile antes de confirmar agendamentos públicos.
- Adicionada verificação independente antes de enviar pedidos públicos de produtos.
- O servidor valida o token, a ação esperada e o domínio autorizado antes de qualquer gravação.
- Tokens ausentes, expirados, reutilizados ou emitidos para outra ação são rejeitados sem alterar dados.
- O segredo do Turnstile permanece somente no ambiente seguro do Cloudflare Worker.

## Experiência do cliente
- A verificação usa o modo gerenciado do Cloudflare e normalmente é concluída sem interação.
- O cliente recebe um estado claro de carregamento, sucesso ou falha antes de enviar o formulário.
- Cada tentativa utiliza um token novo para evitar reutilização acidental.

## Banco de dados
Nenhuma alteração no D1. Não é necessário executar `setup:d1`.
