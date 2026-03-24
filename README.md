# Organizador

Aplicação Next.js + Prisma + PostgreSQL (Neon) com autenticação via NextAuth (Credentials).

## Documentação do projeto
- **Doc principal (robusta, arquivo único):** `docs/PROJECT.md`
- Padrão de IDs (dev/seed): `docs/ID-PREFIXES.md`
- Modelos de dados (referência): `docs/data-model-*.md`

## Comandos principais
Instalar:
```bash
npm i
```

Rodar em dev:
```bash
npm run dev
```

Aplicar migrations (dev):
```bash
npx prisma migrate dev
```

Aplicar migrations (deploy/prod):
```bash
npx prisma migrate deploy
```

## Provisionar um banco novo (nova empresa/projeto)
Depois de criar um banco vazio e apontar o `DATABASE_URL` pra ele, rode:
```bash
npm run provision:db
```
Isso vai:
- aplicar migrations (`prisma migrate deploy`)
- garantir o usuário Support SUPERADMIN (`support.guardian.app@gmail.com`)
- criar um workspace padrão ("Matriz") e o vínculo (ADMIN)
- enviar (ou imprimir no console) um link de definição de senha inicial


## Testes
Unit tests com **Vitest + Testing Library**.

Rodar em modo watch:
```bash
npm test
```

Rodar uma vez (CI):
```bash
npm run test:run
```

