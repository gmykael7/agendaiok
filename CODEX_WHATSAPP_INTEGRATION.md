# AgendAI — Especificação para Codex: Integração WhatsApp

## Objetivo

Adicionar ao AgendAI uma integração oficial com o WhatsApp para transformar o sistema em um motor de atendimento e agendamento automático, preservando integralmente o sistema atual e evitando regressões.

A implementação deve ser feita por etapas. Antes de alterar qualquer arquivo, o Codex deve inspecionar toda a estrutura atual do projeto e entender o fluxo existente de agenda, serviços, profissionais, clientes e notificações.

> IMPORTANTE: não substituir nem reescrever o sistema atual. Integrar a nova camada de WhatsApp de forma desacoplada e compatível com a arquitetura existente.

---

## Stack atual confirmada

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Lucide React
- Cloudflare Workers / Wrangler
- Deploy com `npm run build && wrangler deploy`

O projeto atual é um SaaS para barbearias/salões e já possui portal público de agendamento.

---

# Visão do produto

O cliente deve conseguir agendar diretamente pelo WhatsApp da barbearia/salão, enquanto o AgendAI continua sendo a fonte de verdade da agenda.

Fluxo desejado:

```text
CLIENTE
   ↓
WHATSAPP
   ↓
WhatsApp Cloud API (Meta)
   ↓ webhook
CLOUDFLARE WORKER
   ↓
CLOUDFLARE QUEUE
   ↓
MOTOR DO AgendAI
   ├── identificar estabelecimento
   ├── consultar serviços
   ├── consultar profissionais
   ├── consultar disponibilidade
   ├── criar agendamento
   ├── reagendar
   ├── cancelar
   └── confirmar presença
   ↓
BANCO / ESTADO DO AgendAI
   ↓
WhatsApp + painel administrativo
```

O WhatsApp NÃO deve virar o backend do AgendAI. Ele será apenas um canal de entrada e saída. Toda validação de agenda continua no núcleo do AgendAI.

---

# Tecnologia recomendada

## 1. WhatsApp Cloud API oficial da Meta

Usar prioritariamente a API oficial.

Não usar Baileys, automação via WhatsApp Web ou soluções não oficiais como base do produto SaaS em produção.

Preparar a arquitetura para que futuramente cada estabelecimento conecte seu próprio número pelo Embedded Signup da Meta.

Variáveis sensíveis devem ser armazenadas como secrets do Cloudflare e NUNCA commitadas no repositório.

Exemplos de variáveis:

```text
WHATSAPP_ACCESS_TOKEN
WHATSAPP_VERIFY_TOKEN
WHATSAPP_APP_SECRET
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_BUSINESS_ACCOUNT_ID
```

---

## 2. Webhook no Cloudflare Worker

Criar endpoint dedicado, por exemplo:

```text
GET  /api/whatsapp/webhook
POST /api/whatsapp/webhook
```

Responsabilidades:

- validar webhook da Meta;
- validar assinatura da requisição quando aplicável;
- receber mensagens/eventos;
- responder rapidamente à Meta;
- não executar processamento pesado diretamente no webhook;
- encaminhar o evento para processamento assíncrono.

Evitar duplicidade de processamento usando o `message_id`/event id recebido da Meta.

---

## 3. Cloudflare Queue

Usar Queue para desacoplar a recepção do webhook do processamento.

Fluxo:

```text
Meta → webhook → Queue → worker consumidor → AgendAI
```

Benefícios esperados:

- webhook responde rapidamente;
- retries automáticos;
- maior tolerância a falhas;
- redução de perda de eventos;
- processamento desacoplado.

Criar handlers bem separados para produtor e consumidor.

---

## 4. Controle de concorrência

Implementar uma camada consistente para impedir que dois clientes reservem simultaneamente o mesmo horário.

Avaliar Cloudflare Durable Objects por estabelecimento/agenda.

Exemplo de chave lógica:

```text
agenda:{tenantId}:{date}
```

Regra obrigatória:

```text
Cliente A tenta reservar 14:30
Cliente B tenta reservar 14:30

→ apenas uma reserva pode ser confirmada
→ a segunda tentativa deve receber nova disponibilidade
```

A validação final deve ocorrer no servidor, nunca apenas no frontend.

---

# WhatsApp Flows

Preparar a arquitetura para suportar WhatsApp Flows como principal experiência de agendamento dentro do próprio WhatsApp.

Experiência desejada:

```text
AGENDAR HORÁRIO

Serviço
[ Corte Masculino ]

Profissional
[ Rafael ]

Data
[ 08/09/2026 ]

Horários disponíveis
○ 08:00
○ 08:30
● 09:00
○ 09:30

[ CONFIRMAR AGENDAMENTO ]
```

O Flow deve consultar disponibilidade real do AgendAI.

Endpoint conceitual:

```http
GET /api/availability?tenantId=...&serviceId=...&professionalId=...&date=2026-09-08
```

Resposta conceitual:

```json
{
  "available": ["08:00", "08:30", "09:00", "09:30"]
}
```

Não confiar em horário previamente mostrado ao cliente: validar novamente no momento da confirmação.

---

# Funcionalidades do WhatsApp

O cliente deve futuramente conseguir:

1. iniciar um agendamento;
2. escolher serviço;
3. escolher profissional;
4. escolher data;
5. visualizar horários realmente disponíveis;
6. confirmar agendamento;
7. consultar seus próximos agendamentos;
8. reagendar;
9. cancelar;
10. confirmar presença;
11. receber lembretes;
12. consultar preço do serviço;
13. pedir atendimento humano.

---

# Exemplo de confirmação

```text
✅ Agendamento confirmado!

✂️ Corte Masculino
👤 Profissional: Rafael
📅 08/09/2026
⏰ 14:30
💰 R$ 35,00

[ REAGENDAR ] [ CANCELAR ]
```

No painel administrativo, o agendamento deve aparecer como qualquer agendamento normal, porém com metadados adicionais:

```text
origin: whatsapp
whatsappMessageId: ...
customerPhone: ...
```

---

# Multi-tenant

O AgendAI é SaaS. Nenhuma implementação pode assumir um único estabelecimento.

Todas as entidades e requisições precisam estar associadas a um `tenantId`.

Futuramente, cada estabelecimento deverá poder acessar:

```text
Configurações
  → WhatsApp
      → Conectar WhatsApp
```

Status sugeridos:

```text
disconnected
connecting
connected
error
```

Dados conceituais por estabelecimento:

```ts
interface WhatsAppConnection {
  tenantId: string;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  phoneNumberId?: string;
  businessAccountId?: string;
  displayPhoneNumber?: string;
  connectedAt?: string;
}
```

Tokens secretos NÃO devem ser enviados ao frontend.

---

# Modelo de eventos

Criar tipos internos independentes do formato bruto da Meta.

Exemplo:

```ts
type WhatsAppEvent =
  | { type: 'message.received'; tenantId: string; messageId: string; from: string; text?: string }
  | { type: 'message.delivered'; tenantId: string; messageId: string }
  | { type: 'message.read'; tenantId: string; messageId: string }
  | { type: 'message.failed'; tenantId: string; messageId: string; error?: string };
```

Criar um adapter da Meta para o domínio interno do AgendAI.

Não espalhar payloads específicos da Meta por toda a aplicação.

---

# Idempotência

A Meta pode reenviar webhooks.

Obrigatório impedir que o mesmo evento gere:

- dois agendamentos;
- dois cancelamentos;
- duas mensagens de confirmação;
- duas notificações internas.

Usar o identificador do evento/mensagem como chave de idempotência.

---

# Observabilidade

Registrar eventos importantes de forma estruturada:

```text
whatsapp_webhook_received
whatsapp_message_queued
whatsapp_message_processed
whatsapp_message_failed
booking_created_from_whatsapp
booking_conflict
```

Nunca registrar tokens ou conteúdo sensível desnecessariamente.

Adicionar tratamento de erro e logs compatíveis com a observabilidade já habilitada no Wrangler.

---

# Segurança

Obrigatório:

- secrets somente no Cloudflare;
- nenhuma credencial no frontend;
- validar webhook;
- validar assinatura da Meta;
- sanitizar dados recebidos;
- limitar payloads;
- aplicar rate limiting onde fizer sentido;
- validar `tenantId` no servidor;
- não permitir que um tenant acesse dados de outro;
- validar novamente disponibilidade antes de confirmar reserva.

---

# Arquitetura sugerida de arquivos

O Codex pode adaptar os nomes à estrutura real encontrada, mas manter separação semelhante:

```text
src/
  integrations/
    whatsapp/
      types.ts
      metaAdapter.ts
      client.ts
      messages.ts

worker/
  index.ts
  routes/
    whatsappWebhook.ts
    availability.ts
  queues/
    whatsappConsumer.ts
  services/
    bookingService.ts
    whatsappService.ts
  durable/
    AgendaCoordinator.ts
```

Não criar estruturas duplicadas se o projeto já possuir camadas equivalentes.

---

# Fases de implementação

## Fase 0 — Auditoria

Antes de codificar:

1. ler `README.md`;
2. ler `package.json`;
3. ler `wrangler.jsonc`;
4. mapear `src/`;
5. localizar o modelo atual de agendamento;
6. localizar onde disponibilidade é calculada;
7. localizar persistência/Firebase/API existente;
8. verificar notificações existentes;
9. identificar riscos de regressão;
10. propor plano compatível com a versão atual.

Nenhum arquivo existente deve ser alterado nesta fase.

---

## Fase 1 — Infraestrutura mínima

Implementar somente:

- endpoint de verificação do webhook;
- endpoint POST do webhook;
- adapter de payloads da Meta;
- tipos TypeScript;
- idempotência inicial;
- logs;
- secrets/configuração documentados.

Sem alterar o fluxo de agendamento atual.

---

## Fase 2 — Envio e recebimento

Implementar:

- receber mensagem de texto;
- enviar resposta pelo WhatsApp Cloud API;
- mapear número → tenant;
- registrar falhas;
- fila assíncrona.

---

## Fase 3 — Consulta da agenda

Expor serviços internos seguros para:

- serviços disponíveis;
- profissionais;
- datas;
- horários disponíveis.

Sem criar agendamento ainda pelo WhatsApp.

---

## Fase 4 — Criar agendamento

Implementar criação real via WhatsApp com:

- validação final de disponibilidade;
- idempotência;
- bloqueio de concorrência;
- origem `whatsapp`;
- confirmação ao cliente;
- atualização instantânea do painel.

---

## Fase 5 — Reagendar/cancelar

Implementar:

- consulta do agendamento do cliente;
- autenticação/validação pelo telefone e tenant;
- reagendamento;
- cancelamento;
- confirmação pelo WhatsApp;
- sincronização com painel.

---

## Fase 6 — WhatsApp Flows

Somente depois do backend estar estável:

- configurar Flow;
- integrar seleção de serviço;
- profissional;
- data;
- horários;
- confirmação;
- reagendamento/cancelamento quando aplicável.

---

## Fase 7 — Conectar WhatsApp por estabelecimento

Preparar Embedded Signup da Meta para que cada tenant conecte seu próprio número no AgendAI.

Adicionar UI no painel:

```text
Configurações → WhatsApp
```

Mostrar:

- status;
- número conectado;
- nome exibido;
- última sincronização/atividade relevante;
- desconectar/reconectar quando suportado.

---

# Critérios de aceite

A integração só pode ser considerada pronta quando:

- [ ] webhook da Meta é validado corretamente;
- [ ] POST responde rapidamente;
- [ ] eventos duplicados não geram ações duplicadas;
- [ ] nenhum secret aparece no bundle do frontend;
- [ ] multi-tenant está garantido;
- [ ] dois clientes não conseguem reservar o mesmo horário;
- [ ] agendamento pelo WhatsApp aparece no painel atual;
- [ ] agendamento criado no painel reflete a disponibilidade no WhatsApp;
- [ ] cancelamento/reagendamento sincronizam corretamente;
- [ ] erros possuem logs úteis;
- [ ] build existente continua passando;
- [ ] fluxo atual do portal público continua funcionando;
- [ ] nenhuma funcionalidade existente é removida ou reescrita desnecessariamente.

---

# Regras para o Codex

1. PRESERVAR o sistema atual.
2. Ler os arquivos antes de modificar.
3. Não fazer uma grande reescrita.
4. Implementar incrementalmente.
5. Preferir abstrações pequenas e tipadas.
6. Não inserir chaves/tokens no código.
7. Não usar API não oficial do WhatsApp como dependência principal.
8. Não criar banco paralelo da agenda se o sistema atual já possui fonte de verdade.
9. Não assumir um único tenant.
10. Não publicar/deployar automaticamente sem revisar configuração e build.
11. Rodar `npm run build` após alterações relevantes.
12. Documentar novas variáveis de ambiente e configuração Wrangler.
13. Se encontrar diferenças entre esta especificação e a arquitetura real, adaptar a implementação ao projeto real em vez de forçar esta estrutura.

---

# Primeira tarefa para o Codex

Neste momento, NÃO começar implementando tudo.

Executar primeiro a **Fase 0 — Auditoria** e produzir um plano técnico baseado nos arquivos reais do AgendAI contendo:

1. arquitetura atual encontrada;
2. fluxo atual de agendamento;
3. onde integrar o webhook;
4. onde integrar Queue;
5. se Durable Objects são necessários no estado atual;
6. quais arquivos seriam criados;
7. quais arquivos existentes precisariam ser alterados;
8. mudanças necessárias em `wrangler.jsonc`;
9. estratégia de persistência/idempotência;
10. riscos de regressão;
11. ordem exata de implementação.

Somente depois dessa auditoria iniciar a Fase 1.

---

## Resultado esperado do produto

O AgendAI deve evoluir de uma agenda web para uma plataforma em que o estabelecimento possa oferecer:

> **Atendimento e agendamento automático pelo próprio WhatsApp, com o AgendAI operando por trás e mantendo toda a agenda sincronizada.**
