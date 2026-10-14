import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../test/render'
import { CurriculumImpactPage } from './CurriculumImpactPage'
const mocks = vi.hoisted(() => ({ context: vi.fn(), report: vi.fn() }))
vi.mock('../features/auth/AuthContext', () => ({
  useAuth: () => ({ session: { user: { id: 'fictional' } } }),
}))
vi.mock('../features/content/curriculumPreview', () => ({
  getCurriculumPreviewContext: mocks.context,
  getCurriculumImpact: mocks.report,
}))
describe('curriculum impact page', () => {
  beforeEach(() => vi.resetAllMocks())
  it('does not expose comparison controls without explicit allowed scope', async () => {
    mocks.context.mockResolvedValue([])
    renderApp(<CurriculumImpactPage />)
    expect(await screen.findByText(/No offering is available/)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Compare versions' })).not.toBeInTheDocument()
    expect(mocks.report).not.toHaveBeenCalled()
  })
  it('compares selected published versions without a migration control', async () => {
    mocks.context.mockResolvedValue([
      {
        id: 'o',
        title: 'Fictional course',
        versions: [
          { id: 's', title: 'Source', number: 1 },
          { id: 't', title: 'Target', number: 2 },
        ],
      },
    ])
    mocks.report.mockResolvedValue({
      affected: { direct: 1, cohort: 2, total: 3 },
      counts: { added: 1, removed: 0, changed: 0, total: 1 },
      truncated: false,
      differences: [
        { kind: 'topic', code: 'DRAWING/NEW', title: 'Fictional added topic', change: 'added' },
      ],
    })
    const user = userEvent.setup()
    renderApp(<CurriculumImpactPage />)
    await user.selectOptions(await screen.findByLabelText('Offering'), 'o')
    await user.selectOptions(screen.getByLabelText('Current version'), 's')
    await user.selectOptions(screen.getByLabelText('Compare with version'), 's')
    expect(screen.getByRole('button', { name: 'Compare versions' })).toBeDisabled()
    await user.selectOptions(screen.getByLabelText('Compare with version'), 't')
    expect(mocks.report).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Compare versions' }))
    expect(await screen.findByRole('heading', { name: 'Read-only impact' })).toBeVisible()
    expect(mocks.report).toHaveBeenCalledWith('o', 's', 't')
    expect(screen.getByText('No migration action is available.')).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /Apply|Migrate|Send notice/ }),
    ).not.toBeInTheDocument()
  })
})
