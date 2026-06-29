
# Monaco System — Login interno com 3 contas fixas

## 1. Modelo de autenticação

O sistema deixa de ser multiusuário. Continuamos usando o Lovable Cloud como backend (já tem RLS, realtime, etc.), mas tratamos o login como um sistema de caixa:

- Existem **sempre exatamente 3 contas**, criadas via seed na inicialização:
  - `Atendimento` / `#Elefante98` → perfil **atendimento**
  - `Lavacarro` / `#SkylineGTR34` → perfil **lavajato**
  - `Degenulys` / `#Vacasgordas22` → perfil **gerencia**
- O backend continua usando autenticação por e-mail internamente (requisito da plataforma), mas o usuário **nunca vê e-mail**. Mapeamos cada login para um e-mail técnico interno fixo:
  - `Atendimento` → `atendimento@monaco.local`
  - `Lavacarro`   → `lavacarro@monaco.local`
  - `Degenulys`   → `degenulys@monaco.local`
- Em uma tabela nova `app_accounts` guardamos `username` (case-insensitive), `role` e o `auth_user_id` correspondente. É a fonte de verdade da lista fixa.
- O frontend só pede **Usuário + Senha**. Ao submeter, resolvemos `username → e-mail interno` e fazemos sign-in com a senha digitada.

## 2. Seed das 3 contas

Criado por uma Edge Function `seed-accounts` (idempotente), executada automaticamente:

- Faz `auth.admin.createUser` (e-mail + senha + `email_confirm: true`) só para os usuários que ainda não existem.
- Insere a linha correspondente em `public.app_accounts` e em `public.user_roles` com a role certa.
- Se já existir, não faz nada — não recria nem sobrescreve senhas.
- Disparamos essa função uma vez no boot do app (via `StoreBoot`) — se já estiver tudo seedado, retorna rápido. Também pode ser re-disparada manualmente pelo Gerente.

## 3. Remoções (UI + backend)

- Remover toda UI de cadastro/recuperação:
  - Tela `Auth.tsx`: deixar **somente** campos `Usuário`, `Senha` e botão `Entrar`. Sem abas, sem "Criar conta", sem "Esqueci minha senha", sem Google/Apple, sem texto "primeiro usuário vira gerência".
- Remover trigger `handle_new_user` (que auto-criava perfil/role para qualquer signup) — vamos gerenciar isso apenas no seed.
- Desabilitar signup público no Lovable Cloud (`disable_signup: true`, sem auto-confirm a partir do cliente, sem provedores sociais — só email/senha interno).
- Remover qualquer rota/menu de "usuários", "convidar", etc. (não há hoje, garantimos que não vai aparecer).

## 4. Tela "Contas" (somente Gerente)

Substitui qualquer ideia de gerenciamento de usuários:

- Nova rota `/contas` visível só para `gerencia` (substitui menção a "Configurações de usuários").
- Lista as **3 contas fixas** (não permite criar/excluir — botões simplesmente não existem).
- Para cada conta o Gerente pode:
  - alterar o **login** (atualiza `app_accounts.username`; o e-mail interno permanece, é só um identificador técnico);
  - alterar a **senha** (via Edge Function `update-account-credentials` usando service role para `auth.admin.updateUserById`).
- Validações: login único, mínimo 3 caracteres, sem espaço; senha mínima 8 caracteres.

## 5. Permissões por perfil (revisão da UI/rotas)

| Tela | Atendimento | Lava-jato | Gerente |
|---|---|---|---|
| `/` PDV | ✅ | ❌ | ✅ |
| `/clientes` (somente leitura para atendimento) | ✅ ver/criar; sem editar/excluir | ❌ | ✅ tudo |
| `/historico` (somente leitura para atendimento) | ✅ ver | ❌ | ✅ ver/editar/excluir |
| `/fila` | ❌ | ✅ | ✅ |
| `/dashboard` | ❌ | ❌ | ✅ |
| `/relatorios` | ❌ | ❌ | ✅ |
| `/servicos` (preços, tempos, fidelidade) | ❌ | ❌ | ✅ |
| `/contas` | ❌ | ❌ | ✅ |

Ajustes no `AppShell` e `ProtectedRoute` para refletir exatamente isso. Botões de editar/excluir em Clientes e Histórico ficam ocultos para atendimento.

`primaryRoute()`: gerência → `/dashboard`, lavajato → `/fila`, atendimento → `/`.

## 6. Responsividade mobile (Dashboard e Fila)

- **Fila** (`/fila`): no mobile vira layout de coluna única com tabs `Lavando · Próximos · Lavados`. Cards full-width, botões `Iniciar`/`Finalizar` grandes (44px+), cronômetro em destaque, tipografia escalonada (`text-base` mobile / `text-sm` desktop).
- **Dashboard** (`/dashboard`): grid responsivo (`grid-cols-1 sm:grid-cols-2 xl:grid-cols-4` nos KPIs), gráficos com `ResponsiveContainer` e altura adaptativa, tabelas com scroll horizontal quando necessário. Sidebar continua escondida no mobile (já é o caso, `hidden lg:flex`) — adicionamos topbar com botão de menu para abrir navegação em `Sheet` lateral.

## 7. Detalhes técnicos

- Migração SQL:
  - `create table public.app_accounts (id uuid pk, username citext unique, role app_role, auth_user_id uuid references auth.users on delete cascade, created_at, updated_at)`.
  - GRANTs + RLS: select para `authenticated`; update só para gerência (via `has_role`); sem insert/delete via API.
  - Remover trigger `on_auth_user_created` → `handle_new_user` (e a função se não usada em outro lugar).
- Edge functions (service role):
  - `seed-accounts` — idempotente, lê constantes das 3 contas, cria/garante linhas em `auth.users` + `app_accounts` + `user_roles`.
  - `update-account-credentials` — recebe `{ accountId, newUsername?, newPassword? }`, valida que o caller tem role `gerencia` (via JWT), atualiza `auth.users` e `app_accounts`.
- `configure_auth`: `disable_signup: true`, `auto_confirm_email: true` (necessário para que o seed possa entrar sem fluxo de e-mail), `external_anonymous_users_enabled: false`, `password_hibp_enabled: false` (senhas internas fixas).
- Frontend:
  - `Auth.tsx` reescrito (só usuário/senha). Resolve username → email via select público em `app_accounts` (RLS permite select para anon apenas das colunas `username` e `auth_user_email_alias`? — alternativa: função RPC `resolve_username(text) returns text` security definer que devolve o e-mail interno; usamos essa para evitar expor a tabela).
  - `AuthContext`: sem mudanças estruturais, só ajusta `primaryRoute` e remove dependência do `full_name` que vinha do signup (mostra `username` da `app_accounts`).
  - Nova página `Contas.tsx` + rota.
  - Página `Customers` e `History`: esconder botões editar/excluir quando role = atendimento.

## 8. Fora de escopo

- Reset de senha por e-mail (removido).
- Convite/onboarding de novos usuários (não existe mais).
- Qualquer tela de "Usuários".

---

Confirma para eu seguir com a implementação?
