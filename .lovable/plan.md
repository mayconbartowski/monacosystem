# Atualização Monaco System

Escopo grande mas todo client-side (sem backend). Mantém persistência em localStorage, já usada hoje.

## 1. Cadastro de Clientes

- Remover campo **E-mail** do tipo `Customer` e do form em `Sales.tsx` / `Customers.tsx`.
- Renomear `phone` → mantém a key no banco como `phone` por compatibilidade, mas label e validação viram **WhatsApp**.
  - Obrigatório.
  - Máscara `(99) 99999-9999` (já existe `formatPhone`).
- Migração leve: campo `email` é simplesmente ignorado nas leituras antigas.
- **Live search ao lado do título "Cliente"** no PDV:
  - Input com debounce mínimo (filtra em memória, instantâneo).
  - Dropdown com matches por **nome / CPF / placa** (cruzando `customers` + `vehicles`).
  - Clicar preenche nome, CPF, WhatsApp e abre o veículo + fidelidade automaticamente.
  - Mostra subtítulo "Nome · CPF · Placa" em cada resultado para diferenciar.

## 2. Autenticação local (3 contas fixas)

Tudo client-side, sem Cloud — é um PDV interno. Seguro o suficiente para o caso de uso descrito.

- Novo módulo `src/lib/auth.ts`:
  - Tipos `Role = "atendimento" | "lavajato" | "gerente"`.
  - Seed automático no boot caso o storage esteja vazio:
    - `Atendimento / #Elefante98` → atendimento
    - `Lavacarro / #SkylineGTR34` → lavajato
    - `Degenuly / #Vacasgordas22` → gerente
  - Sempre garante exatamente 3 contas (nunca cria/remove).
  - Senhas armazenadas com hash SHA-256 (Web Crypto) — não em texto puro.
  - API: `login(user, pass)`, `logout()`, `currentUser()`, `updateCredentials(role, {login,password})` (somente gerente).
- `AuthContext` em `src/lib/authContext.tsx` com `useAuth()`.
- `LoginPage` em `src/pages/Login.tsx`: apenas **Usuário**, **Senha**, **Entrar**. Sem qualquer link de signup/recover/social.
- `RequireRole` wrapper para rotas.
- Mapeamento de rotas por papel:
  - `atendimento`: `/` (PDV), `/clientes` (somente leitura), `/historico` (somente leitura).
  - `lavajato`: nova rota `/fila` mobile-first (tela cheia da fila com iniciar/finalizar). Sem PDV, sem clientes, sem financeiro.
  - `gerente`: tudo + `/servicos` + `/configuracoes` (editar credenciais das 3 contas).
- Sidebar e botões respeitam permissões (`canEdit`, `canDelete`).
- Atendimento não pode editar/excluir clientes nem alterar serviços — botões escondidos.

## 3. Tela de Serviços (admin / gerente)

- Nova rota `/servicos`.
- Lista os 4 serviços + extras, agora persistidos em `monaco.services` (seed com `SERVICES`/`DEFAULT_PRICES` atuais).
- Cada item edita: **Título, Descrição, Tempo previsto, Preço por categoria, Status ativo/inativo, Ordem de exibição, Ícone**.
- Botão "Novo serviço" cria item adicional.
- PDV consome a lista dinâmica (filtra inativos, respeita ordem).
- Ícones distintos por serviço (Sparkles, Droplets, Gem, Crown etc.), escolhíveis no editor.

## 4. Refinamento de UI

- Tipografia: hierarquia mais clara (display + body), tracking ajustado.
- Cards: bordas suaves, hover lift, sombras `--shadow-card`/`--shadow-elegant` já existentes; adicionar `--shadow-soft`.
- Animações: transições `transition-all duration-200`, fades em entrada de listas, skeleton loaders em listagens, empty states ilustrados (ícone + título + cta).
- Badges de status por cor semântica (`queued` / `in_progress` / `completed` / `cancelled`).
- Sidebar: indicadores ativos com barra lateral dourada, ícones com micro-bounce no hover.
- Tela `/fila` (lavajato): mobile-first, cards grandes touch-friendly, botões Iniciar/Finalizar em destaque, contador de tempo decorrido por veículo.
- Ícone por serviço também aparece nos cards do PDV, fila e relatórios.
- Botões com `:active` press feedback, toasts já existentes mantidos.
- Loading states em buscas (spinner inline no live search).

## Arquivos novos

- `src/lib/auth.ts`
- `src/lib/authContext.tsx`
- `src/pages/Login.tsx`
- `src/pages/Settings.tsx` (gerente edita credenciais das 3 contas)
- `src/pages/Services.tsx` (admin de serviços)
- `src/pages/Queue.tsx` (tela mobile-first da fila para lava-jato)
- `src/components/RequireRole.tsx`
- `src/components/CustomerLiveSearch.tsx`

## Arquivos alterados

- `src/lib/domain.ts` — remove `email`, marca `phone` como obrigatório, tipos de Role/User/Service persistido.
- `src/lib/storage.ts` — seed de auth/serviços, helpers de busca cruzada cliente/placa.
- `src/App.tsx` — `AuthProvider`, rota `/login`, `/fila`, `/servicos`, `/configuracoes`, guardas por papel.
- `src/components/AppShell.tsx` — menu dinâmico por papel, header com usuário logado e logout, polish visual.
- `src/pages/Sales.tsx` — sem e-mail, WhatsApp obrigatório, live search no card de cliente, ícones por serviço, consumir serviços dinâmicos.
- `src/pages/Customers.tsx` — sem e-mail; ações de editar/excluir só p/ gerente.
- `src/pages/Dashboard.tsx`, `Reports.tsx`, `History.tsx`, `QueueDrawer.tsx` — polish + ícones por serviço; History/Reports só gerente, atendimento vê só leitura do próprio dia.
- `src/index.css` / `tailwind.config.ts` — novas sombras, animações `fade-in`, `slide-up`, `pulse-soft`.

## Notas técnicas (para devs)

- Hash de senha: `crypto.subtle.digest('SHA-256', ...)` → hex. Comparação constante simples.
- Sessão: `monaco.session` no localStorage com `{ role, login, loggedAt }`. Sem expiração (PDV interno).
- Live search: índice montado on-the-fly (≤ alguns milhares de registros — irrelevante). Normaliza CPF/placa antes de comparar.
- Serviços dinâmicos: `db.listServices()`; `pricing.ts` recebe o array em vez de constante.
- Não introduzir Lovable Cloud — pedido é de software interno offline.
