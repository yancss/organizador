import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import { screen } from '@testing-library/react'
import RecipesPage from './page'
import { renderWithProviders } from '@/test/test-utils'

function jsonResponse(body: any, init?: { status?: number }) {
  const status = init?.status ?? 200
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('RecipesPage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: any) => {
        const url = String(input)
        if (url.startsWith('/api/products')) return jsonResponse({ products: [] })
        if (url.startsWith('/api/recipes')) return jsonResponse({ recipes: [] })
        return jsonResponse({}, { status: 404 })
      })
    )
  })

  it('renders and opens new recipe modal', async () => {
    const user = userEvent.setup()
    renderWithProviders(<RecipesPage />)

    expect(await screen.findByRole('heading')).toBeInTheDocument()

    const newBtn = screen.getByRole('button', { name: /nov/i })
    await user.click(newBtn)

    // modal should show save action
    expect(screen.getByRole('button', { name: /salvar|save/i })).toBeDisabled()
  })
})
