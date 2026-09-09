# AgendAI — revisão de qualidade, UX e confiabilidade

Data: 7 de setembro de 2026. Trabalho realizado na cópia local, sem publicação e sem gravações no banco de produção.

## Resultado

A identidade visual, os módulos e a arquitetura React + Vite + Cloudflare Worker/D1 foram mantidos. A revisão aplicou correções direcionadas de navegação, acessibilidade, apresentação, isolamento dos dados e confirmação das operações. O build passou e os 73 testes automatizados passaram, sem falhas ou testes ignorados.

Isso não é uma certificação de ausência de defeitos: as verificações locais estão descritas abaixo, assim como as limitações e os próximos cuidados para produção.

## Proteção do trabalho existente

- Os arquivos foram examinados antes das alterações. A pasta não contém um repositório Git utilizável; não foram executados reset, checkout ou operações equivalentes.
- Foi feita uma cópia prévia dos fontes, testes, arquivos públicos e configurações em `/private/tmp/agendai-review-1ZZ23w/`. É uma cópia temporária do código, não um backup do banco; o sistema operacional pode limpar essa pasta.
- As melhorias anteriores de avisos, envio geral, imagens por URL HTTPS, carrossel, sino e temas foram preservadas.
- Nenhuma chave, conta, mensagem real, agendamento real ou implantação Cloudflare foi alterada. Os testes de gravação usaram exclusivamente SQLite em memória ou uma barbearia fictícia no navegador isolado.
- O diretório `dist` foi regenerado pelo build. As configurações de implantação, bindings e dependências não foram trocadas.

## Correções aplicadas

### Interface e navegação

- Menu principal acessível no celular, incluindo acesso a Relatórios e Produtos.
- Cabeçalho reorganizado nas larguras intermediárias: busca e ações não disputam a mesma linha com o nome da barbearia.
- Saudação do dashboard deixa de ficar espremida ao lado dos botões em tablets.
- Modais compartilhados renderizados fora dos contêineres animados/roláveis, evitando deslocamento e recorte.
- Escape fecha as janelas; o foco retorna ao acionador. A navegação por Tab permanece dentro da janela aberta.
- Central de notificações com altura limitada à tela e rolagem interna.
- Ações dos “Primeiros passos” abrem diretamente Equipe, Serviços ou Perfil/Horários. O fundo claro do componente foi conferido e preservado.
- Melhoria de contraste nos temas claros/escuros, inclusive texto de botões com cores de marca escuras. O contador do sino permanece branco sobre vermelho.
- Preços das opções de serviço deixam de quebrar entre “R$” e o valor nos seletores ajustados.
- Campos associados aos seus rótulos; pesquisas, controles de comissão e botões de fechar receberam nomes acessíveis.
- Seleção de serviços nos modais administrativos e seleção de serviços/profissional no agendamento público funcionam pelo teclado.
- Calendário público anuncia a data completa; página pública tem região principal semântica.
- Zoom do navegador liberado. Campos dos modais móveis usam tamanho de fonte adequado para reduzir zoom involuntário ao digitar.
- Copiar links só indica sucesso quando a área de transferência confirma; falhas agora têm mensagem compreensível.

### Dados e sincronização

- Catálogo e reservas da página pública ficam em estado separado dos dados privados do painel, inclusive durante mudanças de rota na mesma aba.
- Formatos antigos de links públicos por caminho, hash e parâmetros recebem o mesmo tratamento. Um slug inexistente não mostra a barbearia administrativa como substituta.
- Respostas atrasadas de uma rota anterior não são aplicadas depois da mudança de rota.
- Cache de listas com JSON inválido não derruba sozinho a inicialização; o leitor não apaga esse cache.
- Adicionada tela de recuperação para erros de renderização, sem botão que apague os dados.
- Gravações automáticas e manuais usam uma fila. Um estado já substituído por outra edição não é enviado como se ainda fosse o mais recente.
- O polling não substitui alterações locais ainda não confirmadas. Falha de gravação fica visível e há tentativa manual de salvar novamente.
- HTTP 200 contendo HTML, JSON inválido ou sem `success: true` não é tratado como gravação/reserva bem-sucedida.
- Rotas de API desconhecidas retornam erro JSON, não o HTML da aplicação.
- Removido o fallback global em memória do Worker: o banco configurado continua sendo a fonte persistente, sem uma segunda cópia volátil concorrente.

### Reservas, estoque e permissões

- Na reserva pública, profissional e serviços precisam existir e estar ativos no catálogo da própria barbearia.
- Preço, duração e nome do profissional são obtidos no servidor; status é iniciado como agendado. Campos de pagamento enviados pelo visitante não são aceitos como confirmação de pagamento.
- Data, horário, telefone e conjunto de serviços recebem validação. Conflitos consideram a duração real do combo, expediente, intervalo e fechamentos excepcionais.
- Criação administrativa passa a considerar também os bloqueios da data escolhida.
- Atualização condicional por revisão do snapshot evita que duas requisições concorrentes simplesmente substituam uma à outra durante a gravação. O conflito retorna 409 para uma nova tentativa.
- Reenvio da mesma reserva não duplica agenda, cadastro de cliente ou notificação.
- Um autosave antigo preserva a nova reserva pública, seu novo cadastro de cliente, pedidos concorrentes e a correspondente baixa de estoque.
- Pedido público rejeita quantidades inválidas, fracionárias, negativas e acima do limite; preço/estoque inválidos não entram na venda.
- Mudança para um slug já ocupado é recusada antes de sobrescrever o snapshot.
- Restauração do backup na nuvem exige proprietário ou administrador com permissão de Ajustes; contas suspensas são bloqueadas.
- Salvamento de barbeiro preserva agendamentos e avisos dos outros profissionais e campos omitidos da sua leitura restrita.
- Retomada do envio geral de avisos não copia a lista global de e-mails para o card individual. O conteúdo persistido do envio é conferido antes da retomada.

## Verificação realizada

### Automatizada

Comandos executados com sucesso:

```sh
npm run typecheck
npm test
npm run build
```

Resultado: **73 testes, 73 aprovados, 0 falhas, 0 ignorados**.

As suítes anteriores de assistente, avisos, sino e vitrine continuaram passando. A nova suíte `tests/reliability.test.mjs` testa o Worker real compilado, com SQL real em SQLite e um adaptador da interface D1. Não é uma execução do runtime remoto Cloudflare.

Entre os cenários: duas reservas concorrentes, disputa da última unidade de estoque, payload adulterado, quantidade inválida, repetição de reserva, autosave anterior a uma compra/reserva pública, isolamento de permissões, slug ocupado, cache inválido e resposta HTML indevidamente entregue pela API.

### No navegador

Foi usada a aplicação real com dados fictícios, não uma imagem estática. `tests/audit-browser-fixture.js` só funciona na origem local de QA e não é importado pelo aplicativo.

| Cenário | Resultado observado |
| --- | --- |
| Início, Atendimentos, Agenda, Caixa, Produtos, Relatórios, Clientes e Ajustes | Sem transbordamento horizontal do documento em 320, 390 e 1440 px |
| Cabeçalho em 768 px | Elementos dentro da área útil, sem transbordamento do documento |
| Tema claro e marca roxa | Texto branco preservado no botão roxo; avisos e fundos legíveis |
| “Primeiros passos” | Gradiente claro confirmado; ação Serviços abriu o catálogo correto |
| Modal em 390 × 844 | Contêiner em x=0, y=0, largura=390, altura=844; Escape fechou e devolveu foco |
| Menu móvel | Relatórios acessível pelo menu lateral |
| Sino em 320 × 740 | Painel dentro da tela com lista rolável |
| Falha de gravação simulada | Alteração local preservada, aviso exibido, polling sem sobrescrever; nova tentativa sincronizou |
| Público → painel na mesma aba | Nome e cache privados preservados; sem substituir clientes por “Reservado” |
| Slug inexistente | Estado “Barbearia não encontrada”, sem mostrar dados administrativos |
| Agendamento público em cinco etapas | Seleção por teclado, formulário e confirmação funcionaram; uma chamada de reserva; cache privado intacto |
| Conta vazia | Estado vazio e primeiros passos exibidos, sem erro de renderização |
| Superadmin em 390 px | Formulário de texto/imagem e opção “Todas as barbearias” presentes, sem transbordamento |

O envio ao WhatsApp foi bloqueado na simulação de reserva para não abrir contato real. Não foram enviados comunicados de teste a estabelecimentos reais.

### Acessibilidade e carregamento

| Medição local | Resultado |
| --- | --- |
| Lighthouse: entrada pública, modo navegação, mobile | Acessibilidade 100; boas práticas 100; SEO 100 |
| Lighthouse: dashboard claro, snapshot mobile | Acessibilidade 100; boas práticas 100; SEO 100 |
| Lighthouse: agendamento público claro, snapshot mobile | Acessibilidade 100; boas práticas 100; SEO 100 |
| JavaScript principal encontrado no início | 765.796 bytes |
| JavaScript principal do build revisado | Aproximadamente 251,5 KB: redução de cerca de 67% no arquivo principal |
| Trace local da entrada, desktop, CPU 1×, sem limitação de rede | LCP 692 ms; CLS aproximadamente 0,0013 |

A redução é do arquivo principal, não uma promessa de redução igual no aplicativo inteiro. As telas agora são carregadas sob demanda; seus arquivos adicionais continuam existindo. Na entrada medida, os scripts transferidos somaram aproximadamente 269 KB descomprimidos.

As notas Lighthouse dizem respeito aos estados e critérios automatizados auditados, não à conformidade integral com WCAG. A categoria experimental de navegação por agentes não foi usada como critério de aceitação; não foi criado um `llms.txt` apenas para melhorar essa nota.

LCP/CLS são medições de laboratório em localhost, não métricas de usuários reais, 4G ou produção. O trace apontou apenas uma pequena mudança de layout associada à fonte, sem economia estimada que justificasse alterar a tipografia que já funciona.

## Limitações e próxima rodada técnica

1. **Homologação da publicação:** ainda falta validar esta revisão em uma implantação de prévia com Worker e D1 de teste, seguida de iPhone/Safari, Android e PWA instalado. Não publicar apenas `dist`: o frontend e o Worker precisam da mesma revisão, mantendo os bindings atuais. Não foi feita publicação nesta tarefa.
2. **Edição concorrente entre administradores:** o armazenamento atual ainda é um snapshot completo por conta. A comparação de revisão evita a corrida de gravação testada, mas não resolve todas as combinações de edições antigas no mesmo registro por vários aparelhos. Evolução recomendada: versionamento por entidade e operações menores, com estratégia explícita de conflito e migração preservando os dados.
3. **Backup JSON legado:** a exportação/importação local em `SettingsView` cobre um conjunto parcial dos dados e precisa de uma rodada específica para incluir produtos, vendas e notificações e validar restauração ponta a ponta. Não executei importações/restaurações em dados reais nem tratei esse backup como garantia completa.
4. **Prévia antiga de desenvolvimento:** o middleware de `vite.config.ts` possui regras próprias, diferentes do Worker. A homologação de segurança deve continuar usando o Worker; não assumir que o comportamento de `npm run dev` representa toda a API de produção.
5. **Operação real:** entrega de push, permissões revogadas em aparelhos já abertos, recuperação de conexão prolongada, arquivos de imagem externos, quotas e métricas do Cloudflare exigem cenários operacionais adicionais. Também é recomendável revisar proteção contra abuso das rotas públicas antes de ampliar o tráfego.

Não houve troca de banco, migração de dados, redesenho completo ou atualização indiscriminada de dependências. As limitações acima não são descritas como resolvidas.

## Referências de engenharia

As orientações de Cloudflare/Workers guiaram a revisão de persistência e concorrência; a revisão de performance orientou a medição real e o carregamento por tela, sem remover recursos sem evidência.

- [Cloudflare — boas práticas de Workers](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/).
- [Cloudflare D1 — resultados de consultas e `meta.changes`](https://developers.cloudflare.com/d1/worker-api/return-object/).
- [web.dev — Core Web Vitals](https://web.dev/articles/vitals).
- [Chrome — análise do LCP](https://developer.chrome.com/docs/performance/insights/lcp-breakdown).
