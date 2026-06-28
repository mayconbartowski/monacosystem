# Plano — Atualização Monaco System

Vou implementar tudo em uma sequência grande, mas estruturada em blocos. Antes de começar, confirme o plano abaixo.

## 1. Backend (Lovable Cloud)

**Auth + Perfis**
- Habilitar autenticação por e-mail/senha (sem confirmação opcional).
- Tabela `profiles` (id = auth.uid, nome, criado_em).
- Enum `app_role`: `atendimento` | `lavajato` | `gerencia`.
- Tabela `user_roles` (user_id, role) + função `has_role()` (security definer).
- Trigger auto-cria `profiles` ao registrar.
- O **primeiro usuário** registrado vira `gerencia` automaticamente; demais entram como `atendimento` e só `gerencia` pode promover.

**Domínio migrado para o banco** (hoje está em localStorage; precisa ir para o Cloud para ter tempo real e permissões):
- `customers` (id, nome, cpf único, whatsapp, criado_em)
- `vehicles` (id, customer_id, placa única, marca, modelo, cor, ano, categoria, wash_count, reward_available, last_reward_date)
- `services` (id, key, titulo, descricao, duracao_prevista_min, ordem, ativo)
- `service_prices` (service_id, categoria, valor)
- `orders` (id, customer_id, vehicle_id, service_id, extras jsonb, subtotal, desconto, loyalty_discount, loyalty_reward_used, total, pagamento, observacoes, posicao_fila, status, criado_em, iniciado_em, finalizado_em, criado_por)
- `service_time_stats` (service_id, total_lavagens, soma_tempo_real_min) — alimenta a média histórica.

**RLS**
- `atendimento`: SELECT em tudo; INSERT em customers/vehicles/orders; UPDATE de orders só campos operacionais (observação, pagamento). Sem DELETE. Sem edição de services/prices.
- `lavajato`: SELECT em fila/veículos/clientes; UPDATE de orders apenas status/tempos (iniciar, finalizar).
- `gerencia`: tudo (incluindo DELETE e edição de services/prices/categorias).

**Realtime** habilitado em `orders` (e `vehicles` para refletir fidelidade).

**Migração de dados locais**: ao primeiro login do gerente, oferece importar o conteúdo atual do localStorage para o banco (um clique). Sem isso, começa zerado no Cloud.

## 2. Frontend

**Login / Guarda de rota**
- Tela `/auth` (login + cadastro com nome, e-mail, senha, e — apenas para o primeiro usuário — vira gerência automaticamente).
- Hook `useAuth()` + `useRole()`. `AppShell` esconde itens fora do escopo do perfil.
- Atendimento entra direto em `/` (PDV); Lava-jato entra em `/fila`; Gerência vê tudo.

**PDV / Clientes (atualização do cadastro)**
- Remover campo **E-mail** do card de cliente.
- Renomear **Telefone → WhatsApp**, obrigatório, máscara BR `(99) 99999-9999`, validação com zod.
- Ao lado do título "Cliente": **caixa de busca live** (combobox cmdk) que filtra em tempo real por **nome, CPF ou placa** (índice em memória dos `customers` + `vehicles`). Ao escolher um resultado:
  - preenche nome / CPF / WhatsApp,
  - lista os veículos do cliente,
  - mostra histórico resumido + status de fidelidade por placa.

**Tela Fila de Lavagem** (`/fila`, perfis lavajato + gerência)
- 3 grupos: **Lavando** · **Próximos** · **Lavados (hoje)**.
- Card colapsado: `Modelo • Cor • PLACA`.
- Expandido: dados completos do veículo, cliente, serviço, extras, observações, tempo previsto, horário de entrada.
- Botões **▶ Iniciar lavagem** e **✓ Finalizar serviço**:
  - Iniciar grava `iniciado_em`, status `in_progress`, mostra **cronômetro em tempo real** (tick local).
  - Finalizar grava `finalizado_em`, calcula `tempo_real_min`, atualiza `service_time_stats` (soma + contador), move para "Lavados".
- Realtime: novos pedidos do PDV aparecem instantaneamente em todos os terminais; iniciar/finalizar reflete em todos.
- Topo do PDV mostra **tempo médio de espera** calculado a partir de `service_time_stats` (cai para `durationMinutes` padrão enquanto não houver histórico).

**Tela Serviços** (`/servicos`, só gerência)
- Lista de serviços com edição inline de: título, descrição, duração prevista, ordem, status ativo/inativo e **tabela de preços por categoria**.
- Criar novo serviço, desativar (não excluir se houver ordens vinculadas), excluir os sem histórico.

**Permissões aplicadas na UI**
- Atendimento: PDV + Clientes (somente leitura, sem botões editar/excluir) + Histórico (somente leitura).
- Lava-jato: apenas Fila de Lavagem.
- Gerência: Dashboard, PDV, Clientes, Histórico, Serviços, Relatórios, Fila, Configurações.

## 3. Refino de interface
- Densidade e espaçamentos revistos (grid 8px), hierarquia tipográfica mais clara, ícones consistentes (lucide).
- Estados: hover, focus, loading skeletons, empty states ilustrados, toasts de sucesso/erro, badges de status (Na fila / Lavando / Concluído / Recompensa).
- Animações suaves (framer-motion já não é dep; uso transições Tailwind + animações utilitárias existentes).
- Atalhos de teclado no PDV: `/` foca busca cliente, `Enter` confirma etapa.

## 4. Detalhes técnicos
- Camada `src/lib/api/*` substitui as chamadas a `db` do `storage.ts`; o `storage.ts` antigo vira apenas helpers de formatação.
- React Query para fetch/mutate + invalidação por canal realtime.
- zod para validação de formulários (Cliente, Veículo, Serviço).
- Cronômetro: hook `useElapsed(startedAt)` com `requestAnimationFrame` a 1Hz.
- Tempo médio: `avg = sum_real / count`; se `count < 3`, usar `durationMinutes` do serviço.

## 5. Escopo NÃO incluído
- Notificações por WhatsApp/SMS.
- App mobile separado.
- Multi-loja / multi-tenant.
- Importação de clientes via planilha (só botão "migrar do navegador" se houver dados locais).

Confirma para eu seguir? Posso também ajustar qualquer ponto antes de codar.