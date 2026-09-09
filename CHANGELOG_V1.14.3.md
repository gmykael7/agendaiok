# AgendAI v1.14.3 — correção de horários passados

- No agendamento público, horários anteriores ao momento atual deixam de ser exibidos quando a data selecionada é hoje.
- O slot exatamente igual à hora/minuto atual também não pode ser selecionado.
- Se não houver mais horários futuros no dia, o cliente recebe uma mensagem clara para escolher outra data.
- O backend agora rejeita datas e horários passados, evitando contorno da interface por chamada direta à API.
- A validação do servidor usa o fuso da organização quando existir e, por padrão, `America/Fortaleza` (RN).
- Nenhuma migração D1 é necessária.
