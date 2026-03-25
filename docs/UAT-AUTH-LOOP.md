# UAT: Loop de login ("já estou logado" mas /app redireciona para /login)

## Sintoma
- `/login` mostra "Você já está logado"
- qualquer rota `/app/*` volta para `/login`

## Causa mais comum
O **middleware** (Edge Runtime) não consegue validar o JWT via `getToken()` porque o secret não está disponível/igual no Edge.

O `/login` usa `getServerSession()` (Node runtime) e consegue ler a sessão.
O `/app/*` é protegido por `middleware.ts` e depende do secret no Edge.

## Como diagnosticar
Abra:
- `/api/debug/me`

Se vier `session` preenchida, mas você continua tomando redirect no `/app`, é quase sempre `NEXTAUTH_SECRET` no Edge.

## Correção (Vercel)
Garanta que a UAT tenha:
- `NEXTAUTH_SECRET` definido (valor fixo, não pode mudar entre deploys)
- (recomendado) `NEXTAUTH_URL=https://guardian-uat.vercel.app`

Depois:
- limpe cookies do domínio `guardian-uat.vercel.app`
- faça login novamente

## Ajuste no código
O middleware agora usa fallback:
- `NEXTAUTH_SECRET || AUTH_SECRET`

Então você pode configurar `AUTH_SECRET` como alternativa, caso prefira.
