import { screen } from '@testing-library/react'

import { FoundationPage } from './FoundationPage'
import { renderApp } from '../test/render'

describe('FoundationPage', () => {
  it('introduces learning and offers the existing role-specific entrances', () => {
    renderApp(<FoundationPage />)

    expect(screen.getByRole('heading', { name: /Less reading.*More discovering/ })).toBeVisible()
    expect(screen.getByText('Learn')).toBeVisible()
    expect(screen.getByText('Make')).toBeVisible()
    expect(screen.getByText('Grow')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Open Student portal' })).toHaveAttribute(
      'href',
      '/sign-in',
    )
  })
})
