import { z } from 'zod'

// Public self-registration is disabled by default.
// Use the invite flow instead: POST /api/admin/invites + /activate.

const CreateUserSchema = z.object({
  email: z.string().email(),
})

export async function POST(req: Request) {
  // Keep body parsing to return a consistent error message to the UI.
  const body = await req.json().catch(() => null)
  const parsed = CreateUserSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  // Optional escape hatch (e.g., internal demo envs)
  if (process.env.ENABLE_PUBLIC_REGISTRATION === '1') {
    return Response.json(
      {
        error: 'PUBLIC_REGISTRATION_NOT_IMPLEMENTED',
        hint: 'Use the invite flow (/api/admin/invites) or implement public registration behind this flag.',
      },
      { status: 501 },
    )
  }

  return Response.json(
    {
      error: 'REGISTRATION_DISABLED',
      hint: 'Solicite um convite ao administrador para criar sua conta.',
    },
    { status: 403 },
  )
}
