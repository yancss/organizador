# Campos personalizados — Desenho

Data: 2026-08-29

## Objetivo

Permitir que o admin crie campos extras (de tipos variados) nos objetos configuráveis do
sistema, sem alterar schema. Tela única com visão de todos os objetos e seus campos.

Objetos na 1ª rodada: **Orçamento, Cliente, Estoque (item), Produto**.
Tipos na 1ª rodada: **string, number, currency** (enum aberto para date/boolean/select depois).

## Domínio

```
enum CustomFieldEntity { SALES_QUOTE  CLIENT  INVENTORY  PRODUCT }
enum CustomFieldType   { STRING  NUMBER  CURRENCY }   // enum cresce depois

model CustomFieldDefinition {
  id, workspaceId, entity, key, label, type
  required   Boolean @default(false)
  active     Boolean @default(true)
  helpText   String?
  order      Int     @default(0)
  createdById / updatedById / createdAt / updatedAt
  values     CustomFieldValue[]
  @@unique([workspaceId, entity, key])
  @@index([workspaceId, entity])
}

model CustomFieldValue {
  id, workspaceId, fieldId, entityId
  value  Json?         // string | number ; formatação/validação pelo type da definição
  updatedById / updatedAt
  @@unique([fieldId, entityId])
  @@index([workspaceId, entityId])
}
```

- `key`: slug estável gerado do label na criação (`prazo_de_garantia`); imutável depois.
- `type`: imutável se já houver `CustomFieldValue` (senão livre).
- Excluir uma definição com valores: bloqueia (400) — o caminho é desativar (`active=false`).
  Sem valores: apaga.
- `currency` guarda número; a moeda é a do workspace (mesma regra do resto do app).

## API

### Definições (admin)
- `GET  /api/admin/custom-fields` — todas, agrupadas por entidade (ou `?entity=`)
- `POST /api/admin/custom-fields` — cria (`entity, label, type, required?, helpText?, order?`)
- `PATCH /api/admin/custom-fields/[id]` — edita `label, required, active, helpText, order`
  (e `type` só se não houver valores)
- `DELETE /api/admin/custom-fields/[id]` — apaga se não houver valores

Tudo `requireAdmin`, scoping por `workspaceId`, `AuditEvent` nas mudanças.

### Valores (Fase B — próxima rodada)
- `GET /api/custom-fields/values?entity=&entityId=` — definições ativas + valor atual
- `PUT /api/custom-fields/values` — `{ entity, entityId, values: { [key]: value } }`, valida
  por type e `required`, grava em lote.
- Componente reutilizável `<CustomFieldsPanel entity entityId />` para plugar em cada tela
  de detalhe (orçamento, cliente, produto, item de estoque).

## UI (Fase A)

Nova aba em `/app/admin/settings` → **"Campos personalizados"**.

- Seletor de objeto: Orçamento | Cliente | Estoque | Produto.
- Tabela dos campos do objeto: label, chave, tipo, obrigatório, ativo, ordem, ações (editar/excluir/desativar).
- Form "Novo campo": label, tipo (select), obrigatório (checkbox), texto de ajuda, ordem.
- pt/es/en (padrão inline).

## Faseamento

- **Fase A (esta rodada):** modelo + migration + CRUD de definições + aba na central.
  Resultado: dá para **definir** os campos de cada objeto.
- **Fase B:** API de valores + `<CustomFieldsPanel>` + plugar nas 4 telas. Aí os campos
  passam a ser **preenchidos e exibidos**.

## Fora de escopo

- Multi-select, campos calculados, validação por regex, visibilidade condicional,
  campos por perfil, uso dos valores em filtros/relatórios/export.

## Implementado (2026-08-29)

Decisões aplicadas: **todos os objetos de negócio** (22, registry aberto — não literalmente
toda tabela); tipos **STRING, NUMBER, CURRENCY, DATE, BOOLEAN, SELECT**; **Fase A + B**.

- Migration `custom_fields`: `CustomFieldDefinition`, `CustomFieldValue`, enum `CustomFieldType`.
  `entity` é string (registry em código, sem migração para novos objetos).
- `src/lib/custom-fields/registry.ts` — 22 objetos (comercial, compras, catálogo, estoque,
  logística, financeiro, fiscal) + `assertEntityRecordInWorkspace` para ownership.
- `src/lib/custom-fields/field-types.ts` — `coerceCustomFieldValue`, `validateCustomFieldValues`,
  `slugifyFieldKey` (+ testes).
- API definições (admin): `GET/POST /api/admin/custom-fields`, `PATCH/DELETE /api/admin/custom-fields/[id]`.
  `key` imutável; `type` trava se houver valores; excluir com valores → 409 (desativar).
- API valores: `GET/PUT /api/custom-fields/values` (genérica, `requireWorkspace` +
  ownership do registro; valida por tipo e `required`).
- UI: aba **"Campos personalizados"** em `/app/admin/settings` (seletor de objeto + tabela +
  form de criação). Componente reutilizável `<CustomFieldsSection entity entityId />`.
- **Fase B ligada em:** Produto (`/app/products/[id]`) e Cliente (modal). Ligar nos demais
  objetos = só colocar `<CustomFieldsSection>` na tela de detalhe — mecânico, um por vez.
  Orçamento e Estoque ainda não têm tela de detalhe própria; entram quando tiverem.

### Tela "Objetos do sistema" (2ª rodada, 2026-08-29)

Tela dedicada `/app/admin/objects` (item "Objetos" no menu Admin) — visão completa de cada
objeto, incluindo **os campos nativos que o admin não pode alterar**.

- `src/lib/custom-fields/native-fields.ts` — lê o `Prisma.dmmf` e devolve os campos nativos
  (escalares + enums) de cada objeto do registry, com tipo amigável (texto/número/moeda/
  data/lista fixa/JSON), obrigatório/opcional, flag `system` (id, workspace, auditoria) e os
  relacionamentos à parte. Moeda vs número por heurística de nome (`cost|price|amount|value…`).
- API: `GET /api/admin/objects` (lista + contagens), `GET /api/admin/objects/[entity]`
  (nativos + personalizados). CRUD de personalizados continua em `/api/admin/custom-fields*`.
- UI `objects-manager.tsx`: coluna de objetos agrupados + ficha do objeto com "Campos nativos"
  (só leitura), "Relacionamentos" (recolhível) e "Campos personalizados" (CRUD).
- A aba "Campos personalizados" saiu de `/app/admin/settings` (a gestão agora é por objeto
  nesta tela). `settings-hub` voltou a 2 abas.
