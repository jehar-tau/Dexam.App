import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderApp } from '../test/render'
import { StudentCourseworkPage } from './StudentCourseworkPage'

const mocks = vi.hoisted(() => ({ getStudentCoursework: vi.fn() }))

vi.mock('../features/student/getStudentCoursework', () => ({
  getStudentCoursework: mocks.getStudentCoursework,
}))

const liveCoursework = [
  {
    id: 'curriculum-id',
    offeringTitle: 'Design Entrance Foundation',
    title: 'Foundation curriculum 2026',
    versionNumber: 1,
    sections: [
      {
        id: 'section-id',
        code: 'DRAWING',
        title: 'Drawing',
        description: 'Build observation and visual communication skills.',
        position: 1,
        topics: [
          {
            id: 'perspective-id',
            code: 'PERSPECTIVE',
            title: 'Perspective',
            summary: 'Construct believable objects and spaces.',
            position: 1,
            lessons: [
              {
                id: 'lesson-id',
                code: 'ONE_POINT',
                title: 'One-point perspective',
                summary: 'Use one vanishing point.',
                body: 'Practice constructing a simple interior.',
                position: 1,
              },
            ],
          },
          {
            id: 'storyboarding-id',
            code: 'STORYBOARDING',
            title: 'Storyboarding',
            summary: 'Communicate a sequence through frames.',
            position: 2,
            lessons: [],
          },
        ],
      },
    ],
  },
]

describe('StudentCourseworkPage', () => {
  beforeEach(() => mocks.getStudentCoursework.mockReset())

  afterEach(() => vi.unstubAllEnvs())

  it('shows the assigned curriculum and lesson content', async () => {
    mocks.getStudentCoursework.mockResolvedValue(liveCoursework)
    renderApp(<StudentCourseworkPage />, ['/student/coursework'])

    expect(await screen.findByRole('heading', { name: 'Your coursework.' })).toBeVisible()
    expect(screen.getByText('Design Entrance Foundation')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Perspective' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'One-point perspective' })).toBeVisible()
    expect(screen.getByText('Practice constructing a simple interior.')).toBeVisible()
  })

  it('lets the student browse between topics without exposing an assignment flow', async () => {
    const user = userEvent.setup()
    mocks.getStudentCoursework.mockResolvedValue(liveCoursework)
    renderApp(<StudentCourseworkPage />, ['/student/coursework'])

    await screen.findByRole('heading', { name: 'Perspective' })
    await user.click(screen.getByRole('button', { name: /Storyboarding/ }))

    expect(screen.getByRole('heading', { name: 'Storyboarding' })).toBeVisible()
    expect(screen.getByText(/Detailed lesson notes are still being prepared/)).toBeVisible()
    expect(screen.queryByRole('button', { name: /submit assignment/i })).toBeNull()
  })

  it('shows a calm empty state before curriculum assignment', async () => {
    mocks.getStudentCoursework.mockResolvedValue([])
    renderApp(<StudentCourseworkPage />)

    expect(await screen.findByText('Coursework is not available yet')).toBeVisible()
  })

  it('renders lesson content as text instead of executable markup', async () => {
    const unsafeCoursework = structuredClone(liveCoursework)
    unsafeCoursework[0]!.sections[0]!.topics[0]!.lessons[0]!.body =
      '<script>window.lessonWasExecuted = true</script>'
    mocks.getStudentCoursework.mockResolvedValue(unsafeCoursework)
    renderApp(<StudentCourseworkPage />)

    expect(
      await screen.findByText('<script>window.lessonWasExecuted = true</script>'),
    ).toBeVisible()
    expect(document.querySelector('script')).toBeNull()
  })

  it('uses fictional source-informed data only in enabled preview mode', async () => {
    vi.stubEnv('VITE_ENABLE_STUDENT_PREVIEW', 'true')
    renderApp(<StudentCourseworkPage />, ['/student/coursework?preview=1'])

    expect(await screen.findByRole('heading', { name: 'Your coursework.' })).toBeVisible()
    expect(screen.getByRole('button', { name: /Perspective/ })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Line control' })).toBeVisible()
    expect(mocks.getStudentCoursework).not.toHaveBeenCalled()
  })
})
