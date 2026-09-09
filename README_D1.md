# AgendAI - migracao do KV para Cloudflare D1

## Por que esta versao usa D1

O KV continua vinculado apenas para **ler e importar automaticamente os dados antigos**. Nenhuma nova operacao `KV.put()` e feita pelo Worker.

Os dados mutaveis (conta, configuracoes, agenda, clientes, sessoes e notificacoes) passam a ser gravados no D1.

## Primeira instalacao do D1 (somente uma vez)

Dentro da pasta do projeto:

```bash
npm install
npm run setup:d1
npm run deploy
```

O comando `setup:d1`:
1. cria o banco remoto `agendai-db`;
2. adiciona automaticamente o binding `DB` ao `wrangler.jsonc`;
3. cria a tabela `app_store` no D1.

Depois da primeira vez, para novas atualizacoes use somente:

```bash
npm run deploy
```

## Migracao dos dados existentes

Nao e necessario copiar manualmente os dados do KV. Ao consultar uma chave antiga que ainda nao existe no D1, o Worker:
1. tenta o D1;
2. se nao encontrar, le o KV antigo;
3. grava essa chave no D1;
4. dali em diante usa o D1.

O KV fica, portanto, somente como compatibilidade de leitura durante a transicao.

## Otimizacoes de gravacao

- autosave com debounce de 5 segundos;
- nenhuma gravacao quando o conteudo nao mudou;
- o servidor tambem ignora snapshots identicos;
- o payload completo fica em `user:<email>`;
- `slug:<slug>` guarda apenas o e-mail, em vez de duplicar todo o payload;
- polling entre aparelhos foi reduzido de 1,5 s para 10 s e pausa quando a aba esta em segundo plano;
- `BroadcastChannel` continua sincronizando abas do mesmo navegador sem consultar o banco.


## Atualização 1.2
- O card “Sincronização Online Ativa” foi ocultado; a sincronização continua automática em segundo plano.
- O link público do cliente agora usa `/agendar/<slug>` e abre diretamente a tela pública de agendamento, inclusive quando o link é aberto por um PWA instalado.
- Em Ajustes > Perfil do Estabelecimento, configure `Chave Pix` e `Titular do Pix`. Esses dados entram automaticamente na mensagem de confirmação enviada ao cliente pelo WhatsApp.
- O D1 `agendai-db` já está vinculado no `wrangler.jsonc`; para esta conta basta `npm install` e `npm run deploy`.
