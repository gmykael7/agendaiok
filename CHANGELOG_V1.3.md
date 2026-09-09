# AgendAI v1.3.0

Atualizações desta versão:

- Clientes são identificados principalmente pelo telefone. O mesmo número, mesmo com máscara diferente ou com/sem `+55`, não cria cadastro duplicado.
- Cadastros antigos duplicados por telefone são consolidados automaticamente ao carregar/salvar.
- Ajustes de horário ganharam **Descanso / Horário de Almoço**, com chave para ativar e intervalo configurável (ex.: 12:00–14:00).
- O período de descanso é respeitado na página pública, na Agenda, no Dashboard, em Atendimentos e também validado no Worker para impedir agendamento por chamada direta à API.
- O topo com nome do estabelecimento permanece fixo enquanto o conteúdo rola.
- Na Agenda, horários livres aparecem em dois cards por linha; horários ocupados continuam em largura total para preservar os detalhes.
- No Caixa, **Comissões a Pagar** fica ao lado direito de **Faturamento Bruto** no celular; o lucro ocupa a linha seguinte.

## Publicação

Não é necessário recriar o D1 ou o KV. Basta:

```bash
npm install
npm run deploy
```
