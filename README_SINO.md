# Sino de notificações

Adaptação de `Notification Bell.lottie`, fornecido pelo usuário (composição interna `YouTube Bell`, 25 fps, 4 segundos). Os vetores Bézier e os tempos de rotação, badalo e escala foram extraídos para `notificationBellAsset.ts` e renderizados em SVG com animações nativas do navegador. O arquivo original em Downloads não foi alterado. Não há player novo, fontes, CDNs ou chamadas externas.

## Comportamento

- Anima uma vez, durante quatro segundos, ao montar o painel autenticado, somente se houver notificações não lidas.
- Se abrir com tudo lido, não anima. Mensagens que chegam depois apenas atualizam a contagem.
- Navegar entre abas internas, sincronizar, trocar o tema e fechar a central não reiniciam a animação.
- Abrir a central, zerar as não lidas, ocultar o app ou ativar redução de movimento interrompe o efeito.
- Voltar de uma aba em segundo plano não reinicia. Uma nova abertura/carregamento do painel pode animar novamente.
- O número fixo “1” e a bolinha do arquivo foram substituídos pelo contador HTML real (mostra `9+` acima de nove; o rótulo acessível informa o total).
- A escala do contador parte de 1, não de 0, para o número continuar legível. O sino herda a cor do tema e a bolinha mantém número branco em vermelho.
- Sem suporte a animações nativas ou com redução de movimento, permanece um sino estático funcional.

## Testes

`npm run test:bell` verifica regra de abertura, contagem, redução de movimento, duração e repouso, além do SVG e do contador. A prévia isolada existente (`npm run dev:notices-preview`) inclui **Simular notificação**, **Simular abertura do app**, tema claro/escuro e sincronização. Esses controles usam apenas dados fictícios.

Alteração local, sem publicação no Cloudflare. Não modifica agendamentos, notificações armazenadas ou o envio privado de avisos do Superadmin.
