# AgendAi — animações

Abra index.html no navegador. Não exige instalação nem internet.

Recriação aproximada dos movimentos da gravação: entrada escalonada de cards, fade/slide/scale com blur, contadores, barras, indicador de navegação e abertura circular. Identidade verde provisória baseada no vídeo, não na identidade oficial do AgendAi. Dados ilustrativos, sem ligação com agenda real.

Arquivos: index.html (demonstração), styles.css (estilos), motion.js (motor e dados de exemplo), motion.json (parâmetros editáveis, JSON próprio, NÃO Lottie).

O botão “Importar JSON” carrega motion.json e aplica os parâmetros. Sem importação, o motor utiliza os mesmos valores padrão. Os botões laterais alternam Agenda, Clientes e Serviços. “Repetir abertura” reproduz a máscara circular.

Integração: copie styles.css e a classe AgendAiMotion de motion.js. Instancie com o contêiner de tela, o contêiner de navegação e a configuração. Chame motion.show(html) com HTML confiável gerado pelo seu app. Cards usam data-enter; contadores usam data-count="24"; barras usam data-bar e style="--height:70%". O componente de navegação deve conter #indicator e botões com data-page. Para abertura, use .reveal e motion.reveal(). Não passe conteúdo de usuário sem sanitização a show().

Os dados e callbacks demonstrativos ao final de motion.js devem ser substituídos pelas rotas e dados reais do AgendAi. O código respeita prefers-reduced-motion e cancela animações anteriores ao trocar a tela. Nenhuma biblioteca externa. Sem áudio. Não é código extraído do autor do reel.
