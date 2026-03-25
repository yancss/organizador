# Scripts de Banco de Dados (DEV / UAT)

Este documento lista **todos os scripts relevantes para preparar/atualizar bases de dados** no projeto.

> Notas:
> - **DEV local** normalmente usa `DATABASE_URL` do `.env`.
> - **UAT** usa `.env.uat` (scripts `*:uat` carregam esse arquivo).
> - Em Windows, evite rodar `prisma generate` enquanto o `next dev` está rodando (pode dar EPERM por lock do `query_engine`).

---

## Visão rápida (recomendado)

### UAT (do zero até pronta p/ testar processos)

1) (Opcional) Se você resetou o schema manualmente
2) Rodar provision + demo:

```bash
npm run provision:uat:demo
```

Isso faz:
- migrations na UAT
- garante usuário `support.guardian.app@gmail.com`
- carga de dados demo (compras/vendas/estoque/financeiro/custos)

### DEV local (carga demo)

```bash
npm run prisma:migrate
npm run seed:demo
```

---

## Scripts por ambiente

## DEV local

### Aplicar migrations
```bash
npm run prisma:migrate
```

### Prisma Studio (visualizar/editar dados)
```bash
npm run prisma:studio
```

### Gerar Prisma Client
```bash
npm run prisma:generate
```

> Se der erro EPERM no Windows, rode:
```bash
npm run prisma:generate:fix
```

### Seed demo (processos)
Cria dados para testar fluxos (compras/vendas/estoque/financeiro/custos).

```bash
npm run seed:demo
```

---

## UAT

### Aplicar migrations na base UAT
Carrega `.env.uat`.

```bash
npm run prisma:migrate:uat
```

### Garantir usuário default (support)
Cria/atualiza o usuário `support.guardian.app@gmail.com` como `SUPERADMIN` e membro `ADMIN` do workspace.

```bash
npm run ensure:support-user:uat
```

### Seed demo na base UAT
Carrega `.env.uat`.

```bash
npm run seed:demo:uat
```

### Provision UAT (migrate + ensure support)

```bash
npm run provision:uat
```

### Provision UAT + demo (migrate + ensure support + seed demo)

```bash
npm run provision:uat:demo
```

---

## Outros scripts relacionados

### Provisionamento do banco (genérico)
```bash
npm run provision:db
```

### Seed de permissões
> **Não é necessário** para a carga de dados de processos, mas existe no projeto.

```bash
npm run seed:permissions
```

### Bootstrap suporte
```bash
npm run bootstrap
```

---

## Dicas / Problemas comuns

### Erro de migration: `relation "User" already exists`
Isso normalmente indica que o banco já tem tabelas mas o Prisma não tem o histórico das migrations aplicado.
Para UAT de teste, o caminho mais simples é **resetar o schema** e rodar `npm run provision:uat:demo`.

### Seed demo e requisitos mínimos
A seed demo precisa de:
- um `User` (ela cria um `[DEMO] Seed User` se não existir)
- um `Workspace` (ela cria `[DEMO] Workspace` se não existir)

---

## Lista completa de scripts (package.json)

(para referência)

- `prisma:migrate`
- `prisma:migrate:uat`
- `prisma:generate`
- `prisma:generate:fix`
- `prisma:studio`
- `ensure:support-user:uat`
- `seed:demo`
- `seed:demo:uat`
- `provision:uat`
- `provision:uat:demo`
- `seed:permissions`
- `provision:db`
