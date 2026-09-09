# Assistente do AgendAI — piloto

## Estado desta entrega

- Assistente opcional, recolhida, na página pública de serviços.
- Modo guiado funcional por regras: serviços/preços, expediente, contato e consulta de horários.
- Integração com Workers AI preparada, mas **desligada** (`ASSISTANT_AI_ENABLED: "false"`).
- Nenhuma publicação ou reserva real foi realizada. Chamadas reais com exemplos fictícios
  foram feitas somente no laboratório local do OpenRouter; o Worker continua desligado.
- Nenhuma dependência adicionada. `src/worker-configuration.d.ts` é gerado pelo Wrangler.

## Experimentar sem tocar no banco

Execute `npm run dev` e abra [a prévia local](http://127.0.0.1:5173/tests/assistant-preview.html).
Ela usa exclusivamente dados fictícios e bloqueia as requisições de gravação.

1. Abra “Precisa de ajuda para agendar?”.
2. Pergunte “Ver serviços e preços” ou “Quero agendar Corte amanhã”.
3. Ajuste serviço/data/profissional e consulte os horários.
4. Escolha uma opção. O formulário existente abre em Contato com o resumo preenchido.
5. Uma tentativa de confirmar na prévia mostra que nenhuma reserva foi gravada.

O modo de desenvolvimento Vite sempre usa regras locais, mesmo que a flag do Worker seja alterada. Isso evita inferência paga acidental.

## Produção / IA (ainda não ativada)

### Laboratório isolado do OpenRouter (local, não publicado)

Execute `npm run dev:assistant-lab` e abra <http://127.0.0.1:5174>.
É uma página de avaliação separada, não uma ativação da IA na página pública.
Reutiliza o interpretador/validador do piloto e o cálculo de vagas com fixtures.
Não importa o middleware de banco do Vite nem o Worker. Todas as outras rotas `/api/`
ficam bloqueadas, inclusive gravações. Escuta apenas em `127.0.0.1`, porta 5174.

- Padrão da interface: modo guiado, sem rede externa.
- Se quiser testar IA, use `.env.assistant.example` como referência para
  `.env.assistant.local`. A chave vai em `ASSISTANT_LAB_OPENROUTER_KEY`, sem prefixo `VITE_`.
  O arquivo `*.local` está ignorado pelo Git; não compartilhe nem inclua em backups públicos.
- Ative `ASSISTANT_LAB_ENABLED=true`, selecione um ID exato em `ASSISTANT_LAB_MODEL`,
  reinicie o laboratório e marque “Usar IA real nos próximos exemplos”.
- Nenhuma chave é recebida pelo chat ou pela página. Apenas o servidor local lê a configuração.
- Só os seis exemplos cadastrados no servidor podem ser enviados. Texto livre, dados de
  contato, slugs externos e campos adicionais são recusados. O provedor pode registrar
  as frases e o catálogo fictício; não se trata de promessa de retenção zero.
- Antes de cada tentativa, verifica catálogo, suporte a JSON e preço zero de entrada/saída
  (e de requisição, quando informado). Envia também `max_price` zero, sem fallback de
  provedor ou modelo, sem ferramentas, plugins ou pesquisas externas.
- Máximo de 10 tentativas por execução do servidor e uma consulta por vez. Reiniciar
  o servidor reinicia o contador; isso não substitui os limites da conta no provedor.
- Saída limitada a 1.000 tokens no laboratório, incluindo raciocínio interno do modelo.
  O teste real com 200 tokens terminou com `finish_reason: length`, sem JSON final.
  Saídas truncadas são recusadas; o limite do Worker existente não foi alterado.
- Falha de catálogo, modelo removido/pago, erro ou timeout volta ao modo guiado com aviso.
  A interface distingue IA real de regras locais. Não confundir os testes com mocks com
  uma avaliação real de qualidade do modelo.
- A revisão de horário é simulada, sem coletar nome/telefone e sem botão de gravação.
  O filtro “à tarde” existe apenas neste laboratório; não altera a página pública.
- O Owl Alpha não apareceu no catálogo consultado em 03/09/2026. O arquivo local inicial
  propõe `liquid/lfm-2.5-2.6b:free`, listado com preço zero e suporte a JSON na consulta;
  a disponibilidade é reconferida antes de cada tentativa. Não há migração automática.

Verificações sem chamadas externas:

```sh
npm run test:assistant-lab
npx tsc --noEmit -p tsconfig.assistant-lab.json
```

Documentação: [API OpenRouter](https://openrouter.ai/docs/api/reference/overview),
[roteamento e preço máximo](https://openrouter.ai/docs/guides/routing/provider-selection),
[catálogo atual](https://openrouter.ai/api/v1/models).

### Worker existente

Resultado do teste real local em 03/09/2026: chave carregada sem exposição no navegador.
O modelo Liquid configurado ainda não passou na validação ponta a ponta: houve resposta
truncada com 200 tokens, uma rejeição HTTP 429 e retornos ao modo guiado após o ajuste
para 1.000 tokens (interpretação inválida ou timeout). Não considerar a IA aprovada para
publicação. Os testes automatizados usam mocks e continuam separados desta avaliação real.

`POST /api/assistant` consulta o estabelecimento pelo slug no servidor. A rota não cria,
cancela nem altera agendamentos. O fluxo existente de `/api/appointment` continua responsável
pela confirmação e pela verificação final de conflitos.

Para uma ativação futura, revisar a configuração, custos e políticas de dados antes de
alterar `ASSISTANT_AI_ENABLED` para `"true"` e publicar. O binding `AI` já está declarado;
o modelo configurado é `@cf/meta/llama-3.3-70b-instruct-fp8-fast`.

A IA interpreta apenas intenção, serviço, profissional e data. O código valida o resultado
e calcula a resposta usando os dados do sistema. Texto livre gerado pelo modelo não é
mostrado como preço, disponibilidade ou confirmação de reserva.

Dados enviados ao modelo, quando habilitado: mensagem digitada, seleção atual, data de
referência e nomes/IDs públicos de serviços e profissionais. Não são enviados o snapshot,
clientes, telefones de profissionais, credenciais ou finanças. O cliente é orientado a não
informar dados pessoais no chat; o texto que ele digitar ainda será enviado ao provedor.
Conversa limitada às últimas 20 mensagens na memória do componente, sem persistência no D1
ou localStorage. Revisar as políticas do provedor antes de uso real.

Falhas, JSON inválido ou timeout da IA retornam ao modo guiado. Falhas de leitura do servidor
mostram uma mensagem, sem inventar horários a partir de cache local. A interface continua
oferecendo o formulário normal.

## Limites e escopo

- Piloto para um serviço por vez. Combinações usam o fluxo normal.
- Datas entre hoje e 90 dias, fuso `America/Fortaleza` (Brasília). Ainda não há fuso por barbearia.
- Sem WhatsApp automatizado, memória permanente, comandos administrativos ou remarcação.
- No modo guiado, frases não reconhecidas pedem uso dos campos de seleção.
- 500 caracteres por mensagem, corpo máximo de 4 KiB e saída do modelo de até 200 tokens.
- Limiter de 20 consultas/minuto por barbearia e por IP **por localização Cloudflare**.
  Pode afetar usuários atrás do mesmo IP e não é um teto global de gastos.
- Namespace de rate limit proposto: `9801`, com chaves prefixadas `agendai-assistant:`.
  Confirmar a convenção da conta antes de publicação. A IA falha fechada se o limiter estiver ausente.
- Antes de abrir IA ao público, definir orçamento, monitoramento e proteção adicional contra abuso
  (por exemplo, Turnstile), além de validar português e datas com o modelo real em staging.

## Verificação

```sh
npm run typecheck
npm run test:assistant
npm run build
```

O teste automatizado usa mocks da IA e do limiter, sem chamar serviços externos. O build desta
entrega foi direcionado a uma pasta temporária, preservando o `dist` existente.
Os tipos podem ser regenerados com:

```sh
npx wrangler types src/worker-configuration.d.ts --strict-vars false
```

Referências: [Workers AI](https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/),
[rate limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).
