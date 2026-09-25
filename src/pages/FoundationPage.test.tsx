import { screen } from '@testing-library/react'

import { FoundationPage } from './FoundationPage'
import { renderApp } from '../test/render'

describe('FoundationPage', () => {
  it('explains the three engineering foundations', () => {
    renderApp(<FoundationPage />)

    expect(screen.getByRole('heading', { name: 'The Dexam platform starts here.' })).toBeVisible()
    expect(screen.getByText('Frontend')).toBeVisible()
    expect(screen.getByText('Backend')).toBeVisible()
    expect(screen.getByText('Verification')).toBeVisible()
  })
})
