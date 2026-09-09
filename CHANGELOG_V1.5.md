# AgendAI v1.5.0

## Correção estrutural do layout mobile

- O shell administrativo agora ocupa exatamente o viewport e não permite rolagem do documento.
- Somente a área central de conteúdo pode rolar.
- O cabeçalho fica fora da área rolável e também usa `sticky top-0` como proteção adicional.
- A navegação inferior deixou de usar `position: fixed` e agora participa do layout como elemento `shrink-0`.
- O conteúdo central perde automaticamente a altura do cabeçalho e do menu inferior, eliminando sobreposição no fim das páginas.
- Safe area do iPhone continua aplicada no cabeçalho e no menu inferior.
- `html`, `body` e `#root` ficam travados ao viewport para evitar scroll duplo em Safari/Chrome mobile/PWA.
