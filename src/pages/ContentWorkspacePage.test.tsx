import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderApp } from '../test/render'
import { ContentWorkspacePage } from './ContentWorkspacePage'

describe('ContentWorkspacePage', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_OPERATOR_PREVIEW', 'true')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('lets an editor change topic and lesson material in a safe draft preview', async () => {
    const user = userEvent.setup()
    renderApp(<ContentWorkspacePage />, ['/staff/content?preview=1'])

    expect(await screen.findByRole('heading', { name: 'Content workspace' })).toBeVisible()
    const topicTitle = screen.getByLabelText('Topic title')
    await user.clear(topicTitle)
    await user.type(topicTitle, 'Perspective drawing')
    await user.click(screen.getByRole('button', { name: 'Save topic changes' }))

    expect(await screen.findByText('Topic material saved to this draft.')).toBeVisible()
    expect(screen.getByLabelText<HTMLTextAreaElement>(/Lesson material/).value).toContain('horizon')
  })

  it('shows assignment instructions, evaluation guide, private file policy, and publication control', async () => {
    const user = userEvent.setup()
    renderApp(<ContentWorkspacePage />, ['/staff/content?preview=1'])

    await user.click(await screen.findByRole('tab', { name: /Assignments/ }))

    expect(screen.getByLabelText('Student instructions')).toBeVisible()
    expect(screen.getByLabelText(/Evaluation guide for teachers/)).toBeVisible()
    expect(screen.getByText(/maximum 5 files/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Publish assignment' })).toBeDisabled()
  })

  it('creates a new assignment as a private draft linked to the selected topic', async () => {
    const user = userEvent.setup()
    renderApp(<ContentWorkspacePage />, ['/staff/content?preview=1'])

    await user.click(await screen.findByRole('tab', { name: /Assignments/ }))
    await user.click(screen.getByRole('button', { name: 'New assignment' }))
    await user.type(screen.getByLabelText('Internal code'), 'perspective_street')
    const groupInput = screen.getAllByLabelText('Assignment group').at(0)
    const titleInput = screen.getAllByLabelText('Assignment title').at(0)
    const instructionsInput = screen.getAllByLabelText('Student instructions').at(0)
    if (!groupInput || !titleInput || !instructionsInput)
      throw new Error('new assignment form missing')
    await user.type(groupInput, 'Perspective and objects')
    await user.type(titleInput, 'Draw a street corner')
    await user.type(instructionsInput, 'Draw a street using two vanishing points.')
    await user.type(screen.getByLabelText('Evaluation guide'), 'Check convergence and composition.')
    await user.click(screen.getByRole('button', { name: 'Create assignment draft' }))

    expect(await screen.findByText('Assignment draft created.')).toBeVisible()
  })
})
