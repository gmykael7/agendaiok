# AgendAI v1.14 — Usuários e Permissões

- Acessos individuais para administrador e barbeiro.
- Senhas individuais com PBKDF2, sem compartilhar senha do proprietário.
- Vínculo do usuário barbeiro ao profissional da equipe.
- Permissões por módulo: Dashboard, Atendimentos, Agenda, Caixa, Clientes, Relatórios, Ajustes, Equipe e Usuários.
- Ativar/desativar usuário e redefinir senha.
- Menus desktop/mobile respeitam permissões.
- Barbeiro recebe somente os próprios agendamentos na sessão autenticada.
- Salvamento do barbeiro preserva dados dos demais profissionais no servidor.
- Super Admin permanece exclusivo da conta proprietária, mesmo que um funcionário use a mesma barbearia.
- Sem alteração de schema D1: usuários são armazenados no app_store existente.
