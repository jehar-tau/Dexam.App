import { screen, waitFor } from '@testing-library/react'

import { getBackendHealth } from '../features/platform/platformHealth'
import { renderApp } from '../test/render'
import { HealthPage } from './HealthPage'

vi.mock('../features/platform/platformHealth', () => ({
  getBackendHealth: vi.fn(),
}))

const mockedGetBackendHealth = vi.mocked(getBackendHealth)

describe('HealthPage', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetAllMocks()
  })

  it('confirms frontend and backend health without exposing configuration', async () => {
    mockedGetBackendHealth.mockResolvedValue('operational')

    renderApp(<HealthPage />)

    expect(screen.getByRole('heading', { name: 'Application shell operational' })).toBeVisible()
    await waitFor(() => expect(screen.getAllByText('Operational')).toHaveLength(2))
    expect(screen.getByText(/without exposing data/)).toBeVisible()
  })

  it('clearly identifies a fictional-only staging build', async () => {
    vi.stubEnv('VITE_APP_ENV', 'staging')
    mockedGetBackendHealth.mockResolvedValue('not-configured')

    renderApp(<HealthPage />)

    expect(screen.getByText('Non-production environment')).toBeVisible()
    expect(screen.getByText(/fictional test data/)).toBeVisible()
    expect(await screen.findByText('Not configured')).toBeVisible()
  })

  it('shows a safe retry when the backend is unavailable', async () => {
    mockedGetBackendHealth.mockRejectedValue(new Error('private provider detail'))

    renderApp(<HealthPage />)

    expect(await screen.findByText('Unavailable')).toBeVisible()
    expect(screen.getByText(/No private details were returned/)).toBeVisible()
    expect(screen.queryByText(/private provider detail/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible()
  })
})
