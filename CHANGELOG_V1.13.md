# AgendAI v1.13 — Super Admin Agência G7

- Nova rota `/superadmin` isolada do painel das barbearias.
- Ativação inicial segura: bootstrap automático apenas quando existe uma única conta autenticada.
- Lista global de estabelecimentos com busca, status, plano e vencimento.
- Indicadores de contas ativas, em teste, suspensas, clientes e agendamentos.
- Gestão manual dos planos: Teste, Básico, Profissional e Premium.
- Status: Ativo, Teste e Suspenso.
- Suspensão bloqueia login, página pública, TV e criação de novos agendamentos.
- Métricas por estabelecimento sem nova tabela ou migração D1.
- Metadados comerciais protegidos contra sobrescrita pelo sync do cliente.
- Novos cadastros entram como Teste por padrão; liberação e vencimento seguem controle manual do Super Admin.
