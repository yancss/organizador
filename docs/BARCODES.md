# EAN / Código de Barras (Barcodes)

## Visão geral
O Guardian suporta **EAN/códigos de barras** para:
- Vincular um **código (EAN)** a um **produto** (`ProductBarcode`)
- Buscar informações externas (best-effort) via **Open Food Facts**
- Escanear via câmera (quando suportado) usando `BarcodeDetector`

> Nota: o EAN por si só não contém os dados; ele é um identificador. A qualidade/abrangência depende da base externa.

---

## Modelo de dados
- `ProductBarcode` (Prisma)
  - `workspaceId`, `productId`, `code`
  - `source`: `INTERNAL | OPEN_FOOD_FACTS`
  - `externalRef` (opcional)

O código é **único por workspace**:
- `@@unique([workspaceId, code])`

---

## Endpoints
### Lookup (local + externo)
`GET /api/barcodes/lookup?code=...`
- `FOUND_LOCAL`: retorna o barcode + product associado
- `FOUND_EXTERNAL`: retorna payload externo (Open Food Facts)
- `NOT_FOUND`

Arquivo:
- `src/app/api/barcodes/lookup/route.ts`

### CRUD de barcodes por produto
- `GET /api/products/:id/barcodes`
- `POST /api/products/:id/barcodes` (body: `{ code }`)
- `DELETE /api/products/:id/barcodes/:barcodeId`

Arquivos:
- `src/app/api/products/[id]/barcodes/route.ts`
- `src/app/api/products/[id]/barcodes/[barcodeId]/route.ts`

### Scan — Pedido de compra
`POST /api/purchase-orders/:id/scan` (body: `{ code, qty }`)
- Resolve **barcode → produto (local)** e incrementa item do pedido.
- Faz lookup externo best-effort apenas para feedback.

Arquivo:
- `src/app/api/purchase-orders/[id]/scan/route.ts`

### Scan — Pedido de venda
`POST /api/orders/:id/scan` (body: `{ code, qty }`)
- Resolve **barcode → produto (local)** e incrementa item do pedido.
- Produto precisa ser `FINISHED`.

Arquivo:
- `src/app/api/orders/[id]/scan/route.ts`

---

## UI / Fluxos
### Produtos (modal de cadastro/edição)
Local:
- `src/app/app/products/page.tsx`

Comportamento:
- Permite adicionar EAN por digitação e por câmera.
- Em **produto novo**: códigos ficam no draft (`pendingBarcodes`) e são persistidos após criar o produto.
- Ao inserir/escanear um EAN, o sistema chama o lookup e **autopreenche** o máximo possível (sem imagem):
  - `name` (se vazio)
  - `brand` (se vazio)
  - sugere `unit` (g/kg/ml/l/un) quando possível
  - pode sugerir `kind=FINISHED` em produto novo, quando fizer sentido.

### Pedido de compra
Local:
- `src/app/app/purchases/orders/page.tsx`

Botão:
- “Escanear EAN” abre modal com câmera + input manual.

### Pedido de venda (modal do pedido)
Local:
- `src/app/app/order-board.tsx`

Botão:
- “Escanear EAN” abre modal com câmera + input manual.

---

## Requisitos/limitações da câmera
- `getUserMedia` geralmente exige **HTTPS** (ou `localhost`). Em `http://192.168.x.x`, muitos browsers bloqueiam.
- `BarcodeDetector` não é suportado em todos os navegadores (Safari/iOS costuma ter limitações). Deve haver fallback para digitar o código.
