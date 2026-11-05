import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../../test/render'
import { AssignmentReferenceFiles } from './AssignmentReferenceFiles'
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  download: vi.fn(),
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
      client: { storage: { from: () => ({ download: mocks.download }) } },
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
  it('downloads bytes with the session under the descriptive name, with no signed link', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: () => 'blob:fictional/brief',
      revokeObjectURL: () => {},
    })
    mocks.download.mockResolvedValue({ data: new Blob(['pdf']), error: null })
    renderApp(<AssignmentReferenceFiles versionId="version" />)
    await userEvent.click(
      await screen.findByRole('button', { name: 'Download Construction guide' }),
    )
    expect(mocks.download).toHaveBeenCalledWith(
      'offering/version/file.pdf',
      {},
      { cache: 'no-store' },
    )
    expect(click).toHaveBeenCalledOnce()
    const link = click.mock.contexts[0] as HTMLAnchorElement
    expect(link.download).toBe('brief.pdf')
    expect(link.getAttribute('href')).toBe('blob:fictional/brief')
    expect(mocks.dispose).toHaveBeenCalledOnce()
    click.mockRestore()
    vi.unstubAllGlobals()
  })
  it('reports denied access without provider details', async () => {
    mocks.download.mockResolvedValue({ data: null, error: { message: 'Object not found' } })
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
    expect(mocks.download).not.toHaveBeenCalled()
    expect(click).not.toHaveBeenCalled()
    click.mockRestore()
  })
  it('keeps fictional preview disconnected from the backend', () => {
    renderApp(<AssignmentReferenceFiles versionId="preview" preview />)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})
