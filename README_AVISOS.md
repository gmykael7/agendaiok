# Mensagens privadas do Superadmin

Implementação local, sem publicação e sem envio a contas reais.

## Uso

No Super Admin, abra **Mensagens para a barbearia**, escolha **uma** destinatária e escreva o texto livre (até 4.000 caracteres). O título é opcional. Clique em **Revisar mensagem**, confira nome/e-mail e confirme o envio.

O card aparece acima do conteúdo do painel administrativo da destinatária. Não existe opção de envio para todas. Proprietário e usuários com papel `admin` recebem os avisos; barbeiros, página pública e TV não recebem.

Para contribuição, marque **Pedido de apoio voluntário** e, se desejar, preencha PIX, link HTTPS ou ambos. O app não processa pagamentos, não confirma transferências e não bloqueia acesso por falta de contribuição. Confira a chave/destino antes de enviar.

O painel consulta avisos ao abrir, ao voltar à janela e a cada minuto enquanto visível. **Marcar como lida** oculta o card; **Ver mensagens lidas** permite consultá-lo novamente. A leitura é compartilhada pelos administradores daquela barbearia. Contas suspensas só acessam mensagens após reativação.

No histórico da destinatária, o superadmin pode **Retirar do painel** após confirmação. O conteúdo permanece no histórico administrativo. As telas mostram até 50 mensagens recentes por barbearia.

## Preservação e segurança

- Reutiliza `app_store` no D1 existente, com registros `platform-notice:<email codificado>:<UUID>`. Não exige migração de esquema.
- Avisos não entram no snapshot sincronizado de agendamentos/configurações e não são gravados no KV legado.
- `/api/superadmin/notices`: valida a sessão de proprietário vinculada ao Superadmin existente; seleção de destinatária é obrigatória e a conta deve existir.
- `/api/notices`: deriva a destinatária da sessão autenticada, nunca de um e-mail informado pelo navegador. Leitura também valida o registro pertencente a essa conta.
- Retentativas com o mesmo UUID não duplicam nem sobrescrevem mensagens. Leitura/retirada atualizam apenas seu campo de forma atômica.
- Texto renderizado pelo React, sem HTML; links somente HTTPS sem credenciais; limite de corpo e campos no servidor. Conteúdo, PIX e tokens não são registrados nos logs deste recurso.

## Verificação local

Com Node.js 22.13+ (usa SQLite nativo em memória):

```sh
npm run test:notices
npm run typecheck
npx tsc --noEmit -p tsconfig.notices-preview.json
npm run dev:notices-preview
```

Prévia: `http://127.0.0.1:5175/tests/notices-preview.html`. Use os botões **Superadmin de teste**, **Abrir barbearia A** e **Abrir barbearia B**. A prévia usa somente dados fictícios na memória do navegador, que somem ao recarregar. Todas as APIs externas estão bloqueadas; não lê o banco local nem arquivos de chaves.

Os testes exercitam o roteador real do Worker com SQL real em SQLite em memória, adaptando a interface assíncrona do D1. Cobrem autorização, isolamento A/B, leitura, retirada, idempotência, validações, suspensão e preservação de snapshots. Não substituem uma conferência de produção após uma publicação autorizada.
