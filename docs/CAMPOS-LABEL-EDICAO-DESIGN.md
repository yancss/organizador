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

Pendente: ligar `<EntityFieldsSection>` nos demais objetos (mecânico, por tela de detalhe).
