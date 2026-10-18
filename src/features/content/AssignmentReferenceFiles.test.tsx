import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../../test/render'
import { AssignmentReferenceFiles } from './AssignmentReferenceFiles'
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  signed: vi.fn(),
  current: vi.fn(),
  dispose: vi.fn(),
}))
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ session: { user: { id: 'fictional' } } }),
}))
vi.mock('../auth/supabaseClient', () => ({ getSupabaseClient: () => ({ rpc: mocks.rpc }) }))
vi.mock('../auth/accountOperation', () => ({
  captureAccountOperation: () =>
    Promise.resolve({
      client: { storage: { from: () => ({ createSignedUrl: mocks.signed }) } },
      assertCurrent: mocks.current,
      dispose: mocks.dispose,
    }),
}))
describe('named private assignment references', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('VITE_SUPABASE_URL', 'https://fictional.test')
    mocks.rpc.mockResolvedValue({
      data: [
        {
          id: 'a0000000-0000-4000-8000-000000000001',
          file_name: 'brief.pdf',
          display_name: 'Construction guide',
          object_path: 'offering/version/file.pdf',
        },
      ],
      error: null,
    })
  })
  afterEach(() => vi.unstubAllEnvs())
  it('shows descriptive names without treating them as storage paths', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    mocks.signed.mockResolvedValue({
      data: {
        signedUrl:
          'https://fictional.test/storage/v1/object/sign/assignment-materials/offering/version/file.pdf?token=fictional',
      },
      error: null,
    })
    renderApp(<AssignmentReferenceFiles versionId="version" />)
    await userEvent.click(
      await screen.findByRole('button', { name: 'Download Construction guide' }),
    )
    expect(mocks.signed).toHaveBeenCalledWith('offering/version/file.pdf', 60, {
      download: 'brief.pdf',
    })
    expect(click).toHaveBeenCalledOnce()
    expect(mocks.dispose).toHaveBeenCalledOnce()
    click.mockRestore()
  })
  it('rejects cross-origin links and keeps provider details private', async () => {
    mocks.signed.mockResolvedValue({
      data: {
        signedUrl:
          'https://other.test/storage/v1/object/sign/assignment-materials/file?token=wrong',
      },
      error: null,
    })
    renderApp(<AssignmentReferenceFiles versionId="version" />)
    await userEvent.click(
      await screen.findByRole('button', { name: 'Download Construction guide' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be downloaded')
  })
  it('fences download continuation when authentication changes', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    mocks.current.mockImplementation(() => {
      throw new Error('Session changed')
    })
    renderApp(<AssignmentReferenceFiles versionId="version" />)
    await userEvent.click(
      await screen.findByRole('button', { name: 'Download Construction guide' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('current access')
    expect(mocks.signed).not.toHaveBeenCalled()
    expect(click).not.toHaveBeenCalled()
    click.mockRestore()
  })
  it('keeps fictional preview disconnected from the backend', () => {
    renderApp(<AssignmentReferenceFiles versionId="preview" preview />)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})
