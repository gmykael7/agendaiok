# AgendAI v1.4.0 — domínio oficial

- Domínio público oficial definido como `https://meuagendai.fun`.
- Link Cliente agora sempre copia `https://meuagendai.fun/agendar/<slug>` em produção, mesmo se o painel for aberto pelo endereço `workers.dev`.
- Links de abertura/sincronização do app usam o domínio oficial em produção.
- Notificações push abrem o domínio oficial.
- `wrangler.jsonc` passa a declarar `meuagendai.fun` como Custom Domain, mantendo a associação nos próximos deploys via Wrangler.
- Desenvolvimento local continua usando `localhost` automaticamente.

## Layout mobile

- Cabeçalho do estabelecimento permanece parado em todas as páginas; somente o conteúdo central rola.
- Corrigido o final das páginas no celular: o conteúdo recebe espaço seguro acima do menu inferior fixo, incluindo a safe area de iPhone/Android.
- O último card, campo e botão de cada tela agora pode ser rolado completamente para cima do menu inferior.
