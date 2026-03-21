import { z } from 'zod'

// Server-side proxy for ViaCEP (keeps frontend simple and avoids CORS)

const CepSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ''))
  .refine((v) => /^\d{8}$/.test(v), 'INVALID_CEP')

export async function GET(req: Request) {
  const url = new URL(req.url)
  const cepRaw = url.searchParams.get('cep') ?? ''

  const parsed = CepSchema.safeParse(cepRaw)
  if (!parsed.success) return Response.json({ error: 'INVALID_CEP' }, { status: 400 })

  const cep = parsed.data

  const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
    // ViaCEP is public; caching is fine
    cache: 'no-store',
  }).catch(() => null)

  if (!r || !r.ok) return Response.json({ error: 'VIA_CEP_FAILED' }, { status: 502 })

  const data: any = await r.json().catch(() => null)
  if (!data || data.erro) return Response.json({ found: false }, { status: 200 })

  // Map to our internal shape
  return Response.json({
    found: true,
    cep: data.cep ?? null,
    street: data.logradouro ?? null,
    complement: data.complemento ?? null,
    district: data.bairro ?? null,
    city: data.localidade ?? null,
    state: data.uf ?? null,
    ibge: data.ibge ?? null,
  })
}
