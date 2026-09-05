# Campos: rótulo de exibição + edição configurável — Desenho

Data: 2026-08-29
Continuação de `docs/CAMPOS-PERSONALIZADOS-DESIGN.md`.

## O que muda

1. **Rótulo (label) por campo** — nome amigável mostrado ao usuário comum nas telas de
   processo. Hoje só os campos personalizados têm; os **nativos** passam a ter um rótulo
   configurável (o `name` técnico continua interno).
2. **Editável quando possível** — cada campo pode ser marcado como editável na seção de
   campos do processo. Para nativos, só os que estão numa allowlist segura.
3. **Visível** — cada campo nativo pode ser escondido da seção de processo (não some do
   catálogo, só da tela do usuário).

## Domínio

Personalizados já têm `label`, `required`, `active`, `order` em `CustomFieldDefinition`
— nada muda no modelo deles (só passam a ter também um flag de edição implícito: valor
sempre editável).

Novo modelo, só para **nativos**:

```
model EntityFieldConfig {
  id, workspaceId
  entity     String   // chave do registry
  fieldName  String   // nome do campo nativo
  label      String?  // override do rótulo (null = usa o padrão gerado)
  visible    Boolean @default(true)
  editable   Boolean @default(false)
  order      Int     @default(0)
  updatedById, updatedAt
  @@unique([workspaceId, entity, fieldName])
}
```

## Allowlist de edição de nativos

`EDITABLE_NATIVE_FIELDS: Record<entityKey, string[]>` em `native-fields.ts`. Só campos
escalares seguros: nomes, descrições, contatos, endereço, datas de referência. **Nunca**
`id`, FKs, status, valores calculados (`avgCost`, `value`), timestamps de sistema.

Exemplos: `PRODUCT` → `name, brand`; `CLIENT` → `name, phone, email, observations, address*`;
`SALES_QUOTE` → `name, observations, validUntil`; `WAREHOUSE` → `name, code`.

Um nativo fora da allowlist: o toggle "Editável" fica desabilitado com dica.

## API

### Catálogo (admin) — `/api/admin/objects/[entity]`
Cada nativo passa a devolver: `label` (efetivo), `configuredLabel`, `visible`, `editable`,
`editableEligible`, `order`.

Novo: `PATCH /api/admin/objects/[entity]/fields/[fieldName]` — upsert do `EntityFieldConfig`
(`label`, `visible`, `editable`, `order`). Recusa `editable=true` se não for elegível.

### Valores (usuário) — `/api/entity-fields`
- `GET ?entity=&entityId=` — devolve os campos **visíveis** (nativos + personalizados) na
  ordem configurada, com rótulo, tipo, `editable` e valor atual.
- `PUT` — salva num lote:
  - personalizados → caminho atual (`CustomFieldValue`, validação por tipo);
  - nativos editáveis → update genérico no registro real, restrito à allowlist e
    validado por tipo (coerção compartilhada).

## UI

- **Componente** `<EntityFieldsSection entity entityId />` (evolui o atual
  `<CustomFieldsSection>`): renderiza os campos visíveis com o rótulo; editáveis como input,
  os demais como leitura. Um "Salvar" único. Não aparece se não houver campo visível.
- **Tela "Objetos do sistema"**: na tabela de nativos entram colunas **Rótulo** (input,
  salva ao sair), **Visível** (toggle), **Editável** (toggle, desabilitado se não elegível),
  **Ordem**. A tabela de personalizados ganha edição inline de **Rótulo** e **Ajuda**.

## Faseamento

- **Rodada 1 (esta):** modelo + allowlist + API do catálogo + tela de objetos + API de
  valores + `<EntityFieldsSection>` ligado em **Produto e Cliente**.
- **Rodada 2:** ligar nos demais objetos (mecânico) + edição inline de mais props do campo.

## Fora de escopo

Reordenar por arrastar, layout em colunas/abas, campos condicionais, permissão de edição
por papel, histórico de alteração de rótulo.

## Implementado (2026-08-30)

Decisões: label vale para **nativos + personalizados**; a tela de config é **admin-only**
(já era); usuário comum edita valores nas telas de processo conforme o admin liberou;
ligado em **Produto, Cliente e Orçamento** (novo detalhe de orçamento).

- Migration `entity_field_config`: `EntityFieldConfig` (workspace, entity, fieldName →
  label?, visible, editable, order). Só para nativos.
- `native-fields.ts`: `EDITABLE_NATIVE_FIELDS` (allowlist por objeto — só escalares seguros),
  `defaultFieldLabel` (humaniza camelCase), `editableEligible` por campo.
- `entity-field-config.ts`: `getNativeFieldViews` — junta nativo + config. **Nativos começam
  ocultos**; o admin ativa "Visível" para expor na tela do usuário.
- API: `PATCH /api/admin/objects/[entity]/fields/[fieldName]` (label/visible/editable/order,
  recusa editable em campo não elegível). `GET /api/admin/objects/[entity]` passa a devolver
  a config por nativo.
- API `/api/entity-fields` GET/PUT — a tela do processo: devolve campos visíveis (nativos +
  personalizados) com rótulo e `editable`; grava valores em lote (nativo editável → update no
  registro real via allowlist + coerção por tipo; personalizado → `CustomFieldValue`).
  Substitui `/api/custom-fields/values` (removida).
- Componente `<EntityFieldsSection>` (evolui `<CustomFieldsSection>`, removida): rótulos,
  editáveis como input, o resto como leitura, um "Salvar".
- Tela "Objetos do sistema": tabela de nativos com colunas Rótulo / Visível / Editável /
  Ordem; tabela de personalizados com edição inline de rótulo e ajuda.
- Nova tela de detalhe do orçamento: `/app/sales/quotes/[id]` (código na lista vira link).

### Rollout (2026-08-30)

`<EntityFieldsSection>` ligado em **8 objetos**:
- Telas de detalhe: Produto, Orçamento, Pedido de venda, Entrega, Recebível.
- Modais de edição: Cliente, Pedido de compra, Receita.

### Rota genérica (2026-08-30)

Para os objetos sem tela de edição própria: rota universal `/app/records/[entity]/[id]`
(qualquer um dos 22) — cabeçalho com o objeto + identificação do registro + `<EntityFieldsSection>`
+ histórico. `/api/entity-fields` GET passa a devolver também `record` (título/subtítulo) e
`entity` (rótulos).

Links "Campos → abrir" adicionados nas listas de **Conta a pagar** e **Devolução**. Levar a
rota para as demais listas é uma linha (`<Link href={/app/records/<ENTITY>/<row.id>}>`).

### Abas na tela "Objetos do sistema" (2026-08-30)

A ficha do objeto passou a ter 3 abas:
- **Campos** — tabelas de nativos (rótulo/visível/editável/ordem) e personalizados (CRUD).
- **Relações** — os relacionamentos do objeto (campo → model destino).
- **Layout** — lista unificada dos campos visíveis, ordenável (▲▼ por ora; arrastar e soltar
  depois). Reordenar renumera `order` (0..n) e persiste em `EntityFieldConfig` /
  `CustomFieldDefinition`.

`/api/entity-fields` GET passou a **mesclar** nativos e personalizados numa única ordem
(`order`), em vez de "nativos primeiro, personalizados depois". É essa ordem que a aba
Layout controla e que o `<EntityFieldsSection>` respeita.

### Nome/descrição do objeto + tabela enxuta (2026-09-05)

- **`EntityConfig`** (migration `entity_config`): `workspaceId + entity → label?, description?`.
  `null` = usa o rótulo padrão do registry. Helper `getEntityDisplay` /
  `getEntityDisplayMap` em `src/lib/custom-fields/entity-config.ts`.
- `PATCH /api/admin/objects/[entity]` (novo) — grava `label`/`description` do objeto
  (admin-only, com audit `EntityConfig`). `GET` do objeto e da lista devolvem
  `configuredLabel` + `description`. `/api/entity-fields` GET aplica o override no
  `entity.labels` e devolve `description` (a rota genérica `/app/records/...` mostra).
- **Tela "Objetos do sistema"**:
  - Lista lateral em **ordem alfabética**, sem separação por módulo.
  - Aba **Campos** com um cartão "Objeto" no topo: nome de exibição + descrição
    (salva ao sair do campo).
  - Tabela de **campos personalizados** enxuta: **Rótulo · Nome · Tipo · Editar/Excluir**
    (sem opções de lista, obrigatório, ordem ou ativar/desativar na grade).
  - Edição num formulário completo (o de "Adicionar campo" vira Editar): rótulo, tipo,
    obrigatório, ativo, ajuda e opções. A coluna Tipo dos nativos não mostra mais os
    valores do enum entre parênteses.

### Busca + ordenação + Layout como controle único (2026-09-05)

- **Campo `order`**: é a posição do campo na tela do usuário (`/api/entity-fields`
  mescla nativos + personalizados e ordena por ele). Deixou de ser editável na grade de
  Campos — passa a ser gerido só na aba **Layout**.
- Aba **Campos**:
  - Busca por objeto acima da lista lateral; busca por campo acima das tabelas (filtra
    nativos + personalizados por nome técnico e rótulo).
  - Tabelas em **ordem alfabética por padrão** (pelo rótulo), com **cabeçalhos
    clicáveis** para ordenar por qualquer coluna (▲▼).
  - Saíram as colunas **Visível** e **Editável** dos nativos — essas permissões passam a
    ser por perfil (mais adiante). Enquanto isso, nativos entram como **somente leitura**
    na tela do usuário; personalizados continuam editáveis.
- Aba **Layout** vira o **controle único** de exibição:
  - "Na tela do usuário": lista ordenável (▲▼) + `✕` para tirar da tela.
  - "Campos disponíveis": chips `+ <campo>` para adicionar (nativo → `visible=true`,
    personalizado → `active=true`; ordem = fim da lista).
  - Esconder um personalizado da tela = desativá-lo (`active=false`); ele continua no
    catálogo da aba Campos para reativar/editar.
- **Coluna "Ações"** nas duas tabelas de Campos:
  - Nativos: **Editar** (abre o rótulo inline com Salvar/Cancelar) e **Excluir** (remove só
    o rótulo personalizado e volta ao padrão — com `window.confirm`; desabilitado se não há
    personalização).
  - Personalizados: **Editar** (formulário) e **Excluir** (agora com `window.confirm`;
    bloqueado se o campo tem valores).

### Modal de campo + tipo RELATION (2026-09-05)

- O formulário de criação/edição saiu do rodapé da tela. Botão **"Novo campo"** à direita
  da busca de campos (movida para a esquerda) abre um **modal** (mesmo modal serve para
  editar, pelo botão Editar da linha).
- Novo tipo **`RELATION`** (migration `custom_field_relation_type`): enum `CustomFieldType`
  += `RELATION`; `CustomFieldDefinition.relationEntity` (chave do objeto alvo no registry).
  O valor guardado em `CustomFieldValue` é o **id** do registro apontado.
  - Criação/edição: exige `relationEntity` válido e **diferente do próprio objeto**
    (`RELATION_NEEDS_TARGET` / `RELATION_SELF`); trocar o alvo com valores existentes é
    bloqueado (`RELATION_LOCKED_WITH_VALUES`).
  - `POST/PATCH /api/admin/custom-fields`, `GET /api/admin/objects/[entity]` e
    `/api/entity-fields` passam a carregar `relationEntity`.
  - `/api/entity-fields` GET resolve `relationLabel` (rótulo do registro apontado) e o PUT
    valida que o id existe no workspace e no objeto certo (`INVALID_REFERENCE`).
  - Novo `GET /api/entity-fields/options?entity=<key>&q=` — até 100 registros (id + rótulo)
    do objeto alvo, para o seletor. Helpers em `src/lib/custom-fields/entity-records.ts`.
  - `<EntityFieldsSection>` renderiza o campo RELATION como `<select>` (busca as opções sob
    demanda); leitura mostra o `relationLabel`.
