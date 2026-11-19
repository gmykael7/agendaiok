# AGENTS.md

Instruções pra qualquer agente que mexer na interface deste projeto.

## Design: 10 ajustes finos (valem pra toda interface que você criar ou editar)

1. Raio concêntrico: elemento arredondado dentro de outro usa o raio de fora menos o espaçamento entre eles. Ex.: cartão com border-radius 24px e padding 8px, o de dentro fica com calc(24px - 8px). Nunca o mesmo raio nos 2.
2. Bordas com transparência: rgb(0 0 0 / 0.12) no tema claro e rgb(255 255 255 / 0.12) no escuro, no lugar de hex sólido como #e4e4e7, pra borda se misturar com qualquer fundo.
3. Paletas em OKLCH, não em HSL: cores irmãs têm o mesmo L e o mesmo C e mudam só o H, ex.: oklch(76% 0.12 29), oklch(76% 0.12 144), oklch(76% 0.12 259). O C fica dentro do sRGB.
4. Degradês com in oklch: linear-gradient(90deg in oklch, #2563eb, #f59e0b), com a mesma linha sem in oklch logo antes como reserva. No Tailwind v4, bg-linear-to-r/oklch. Se aparecer um matiz que não está em nenhuma das pontas, use in oklab.
5. Traço do ícone acompanha o peso do texto do lado. Ícone de 20px com texto de 16px: peso 400 = stroke-width 1.75, 500 = 2, 600 = 2.5, 700 = 2.75. Outro tamanho: stroke-width = haste do texto em px vezes 24 dividido pelo tamanho do ícone em px.
6. Carrosséis e listas com rolagem horizontal somem nas pontas: mask-image e -webkit-mask-image com linear-gradient(90deg, transparent, #000 15% 85%, transparent). Setas e botões ficam fora do elemento com máscara.
7. Troca de ícone (copiar e copiado, play e pause, menu e fechar): os 2 ícones no mesmo lugar, o escondido com opacity: 0 e filter: blur(4px), transição de 200ms em opacity e filter, e transition: none dentro de @media (prefers-reduced-motion: reduce).
8. Modo escuro mostra profundidade com superfície mais clara, não com sombra: página, cartão e menu sobem uns 7 pontos de L no OKLCH a cada nível, ex.: #0b0b0d, #1c1c20 e #2d2d33, com borda rgb(255 255 255 / 0.08) na camada de cima.
9. Altura de tela cheia: min-height: 100vh seguido de min-height: 100dvh, nunca 100vh sozinho (no Tailwind, min-h-dvh no lugar de min-h-screen). Se a seção pular quando a barra do navegador aparece, use 100svh.
10. Foto de produto com fundo branco em cima de fundo claro colorido: mix-blend-mode: multiply na img e isolation: isolate no cartão. Nunca em fundo escuro.

Ao terminar uma mudança de interface, confira esses 10 itens no que você alterou e diga quais aplicou.
