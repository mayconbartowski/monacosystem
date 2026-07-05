## Centralizar ícones no menu recolhido

**Problema:** No sidebar recolhido, os ícones dos NavLinks aparecem levemente deslocados à esquerda em vez de perfeitamente centralizados na coluna.

**Causa:** O `NavLink` mantém `gap-3` na className base mesmo quando recolhido, e o container `nav` usa `p-2` assimétrico em relação ao `w-16` da aside, deixando o box de hover e o ícone fora da grade central.

### Alteração (apenas `src/components/AppShell.tsx`)

No `className` do `NavLink` dentro do `nav`:
- Remover o `gap-3` fixo e aplicá-lo somente quando expandido.
- Garantir no estado recolhido: `mx-auto w-10 h-10 justify-center items-center p-0` (box quadrado 40×40 centralizado dentro dos 48px internos do nav).
- Manter `justify-center` e o ícone `shrink-0` já existentes.

Nenhuma outra mudança de layout, estilo, comportamento ou lógica.
