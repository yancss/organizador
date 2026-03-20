import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/test-utils'

vi.mock('@/app/app/order-board', () => {
  return {
    default: () => <div>OrderBoardMock</div>,
  }
})

import SalesOrdersPage from './page'

describe('SalesOrdersPage', () => {
  it('renders OrderBoard', () => {
    renderWithProviders(<SalesOrdersPage />)
    expect(screen.getByText('OrderBoardMock')).toBeInTheDocument()
  })
})
