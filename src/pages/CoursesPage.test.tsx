import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../test/render'
import { CoursesPage } from './CoursesPage'

const mocks = vi.hoisted(() => ({ list: vi.fn(), save: vi.fn() }))
vi.mock('../features/auth/AuthContext', () => ({
  useAuth: () => ({ session: { user: { id: 'fictional' } } }),
}))
vi.mock('../features/enrolment/courses', async (importOriginal) => {
  const original = await importOriginal<typeof import('../features/enrolment/courses')>()
  return { ...original, getCourses: mocks.list, saveCourse: mocks.save }
})
const course = {
  id: '00000000-0000-4000-8000-0000000000a1',
  code: 'FIXTURE',
  title: 'Fictional Course',
  status: 'active' as const,
  durationDays: 365,
  totalFeePaise: 15000000,
  admissionFeePaise: 1000000,
  revision: 3,
  openEnrolments: 2,
}
describe('CoursesPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.list.mockResolvedValue([course])
    mocks.save.mockResolvedValue(course.id)
  })
  it('lists courses with their length and fees', async () => {
    renderApp(<CoursesPage />)
    expect(await screen.findByText('Fictional Course')).toBeInTheDocument()
    expect(screen.getByText(/365 days/)).toHaveTextContent('₹1,50,000')
    expect(screen.getByText(/365 days/)).toHaveTextContent('Admission ₹10,000')
  })
  it('adds a course with fees in paise', async () => {
    const user = userEvent.setup()
    renderApp(<CoursesPage />)
    await screen.findByText('Fictional Course')
    await user.type(screen.getByLabelText('Course code'), 'NID-2027')
    await user.type(screen.getAllByLabelText('Course name')[0]!, 'NID 2027')
    await user.type(screen.getAllByLabelText('Course length (days)')[0]!, '300')
    await user.type(screen.getAllByLabelText('Total fee (₹)')[0]!, '1,20,000')
    await user.type(screen.getAllByLabelText('Admission fee (₹)')[0]!, '5000')
    await user.type(screen.getAllByLabelText('Reason')[0]!, 'New batch year')
    await user.click(screen.getByRole('button', { name: 'Add course' }))
    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        courseId: null,
        code: 'NID-2027',
        durationDays: 300,
        totalFeePaise: 12000000,
        admissionFeePaise: 500000,
      }),
    )
  })
  it('edits an existing course at its current revision', async () => {
    const user = userEvent.setup()
    renderApp(<CoursesPage />)
    await user.click(await screen.findByRole('button', { name: 'Edit Fictional Course' }))
    const lengths = screen.getAllByLabelText('Course length (days)')
    await user.clear(lengths[1]!)
    await user.type(lengths[1]!, '400')
    await user.type(screen.getAllByLabelText('Reason')[1]!, 'Longer course')
    await user.click(screen.getByRole('button', { name: 'Save course' }))
    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({ courseId: course.id, expectedRevision: 3, durationDays: 400 }),
    )
  })
})
