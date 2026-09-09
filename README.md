# AgendAI — versão Cloudflare D1 + PWA

Sistema de agenda para barbearias com painel administrativo, link público de agendamento, sincronização entre aparelhos, comissões e notificações Web Push.

## O que foi corrigido nesta versão

### Sincronização sem zerar os dados

- O login em um aparelho novo agora carrega o **snapshot completo da nuvem** antes de liberar o autosalvamento.
- O frontend não envia listas vazias enquanto a conta ainda não foi hidratada pelo Cloudflare D1.
- A página pública do cliente não pode sobrescrever os dados privados do painel.
- O servidor rejeita uma gravação totalmente vazia quando a conta já possui serviços, profissionais, agendamentos ou clientes.
- Antes de cada gravação administrativa válida, o Worker mantém um snapshot em `backup:last:<email>`.
- Em **Ajustes → Perfil / Configurações**, há a ação **Último Backup da Nuvem** para restaurar o snapshot anterior criado por esta versão.

> Importante: o backup de nuvem começa a existir somente depois que esta versão for implantada e realizar uma gravação válida. Ele não recria dados que já tenham sido apagados antes do deploy desta versão.

### Notificações Android e iPhone/iPad

- Service Worker: `public/sw.js`
- Manifest PWA: `public/manifest.webmanifest`
- Ícones 192px e 512px
- Assinatura Web Push por aparelho
- VAPID gerado e armazenado no Cloudflare D1
- Novo agendamento público dispara uma notificação nos aparelhos administrativos inscritos

No Android, entre no painel e use **Ajustes → Configurações da Barbearia → Ativar Notificações neste Aparelho**.

No iPhone/iPad:
1. Abra o AgendAI no navegador.
2. Use **Compartilhar → Adicionar à Tela de Início**.
3. Abra o AgendAI pelo novo ícone.
4. Faça login novamente, se solicitado.
5. Vá aos Ajustes e toque em **Ativar Notificações neste Aparelho**.

### Comissões

- Comissão editável de **0% até 100%**.
- Slider chega a 100%.
- Botão rápido **100%** no ajuste do profissional.

### Personalização

Em Ajustes há paletas predefinidas e seletores manuais para:
- cor principal;
- fundo do aplicativo;
- superfícies/cards.

### Área segura do celular

O cabeçalho e a navegação inferior usam `safe-area-inset-*`, evitando que conteúdo fique embaixo da barra de status, notch ou indicador inferior em modo PWA.

## Cloudflare D1 (banco principal)

Esta versão usa **D1 para todas as novas gravações**. O binding antigo `AGENDAI_KV` fica somente como fonte de leitura para migrar automaticamente dados existentes. O Worker não executa mais `KV.put()`.

Na primeira instalação desta versão, execute uma única vez:

```bash
npm install
npm run setup:d1
npm run deploy
```

`npm run setup:d1` cria `agendai-db`, adiciona o binding `DB` ao `wrangler.jsonc` e inicializa `schema.sql`. Depois disso, atualizações futuras usam apenas `npm run deploy`.

A migração é preguiçosa e automática: quando uma chave ainda não existe no D1, o Worker lê o KV legado e copia o valor para o D1.

### Redução de operações

- autosave com debounce de 5 segundos;
- snapshots idênticos não são gravados;
- o backend também rejeita gravação redundante;
- `slug:<slug>` guarda apenas o e-mail, não uma segunda cópia do snapshot;
- sincronização entre aparelhos consulta a cada 10 segundos e pausa com a aba oculta;
- abas do mesmo navegador continuam usando `BroadcastChannel`, sem banco.

## Instalação e deploy

No Terminal, dentro da pasta do projeto:

```bash
npm install
npm run typecheck
npm run deploy
```

`npm run deploy` executa o build e depois publica com Wrangler, enviando juntos:
- frontend React;
- Worker/API;
- assets PWA;
- binding `DB` (D1);
- binding `AGENDAI_KV` somente para migração de leitura dos dados antigos.

Não publique apenas a pasta `dist` por upload manual, pois as rotas `/api/*` precisam executar o Worker.

## Testes recomendados depois do deploy

1. No computador, faça login e confirme serviços/profissionais/agendamentos.
2. No celular, faça login com a mesma conta e confirme que os mesmos dados aparecem antes de alterar qualquer coisa.
3. Altere um item no celular e confirme no computador.
4. Teste **Salvar na Nuvem** com dados carregados.
5. Ative notificações no aparelho.
6. Abra o link público em outro navegador e crie um agendamento.
7. Confirme que o agendamento aparece no painel e que a notificação chega ao aparelho inscrito.
8. Em iPhone/iPad, teste em modo instalado pela Tela de Início.
