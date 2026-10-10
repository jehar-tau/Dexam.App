import { getStudentCoursework } from './getStudentCoursework'

const mocks = vi.hoisted(() => ({
  curricula: vi.fn(),
  lessons: vi.fn(),
  sections: vi.fn(),
  topics: vi.fn(),
}))

vi.mock('../auth/supabaseClient', () => ({
  getSupabaseClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({ order: mocks.curricula }),
        in: () => ({
          order:
            table === 'curriculum_sections'
              ? mocks.sections
              : table === 'curriculum_topics'
                ? mocks.topics
                : mocks.lessons,
        }),
      }),
    }),
  }),
}))

describe('getStudentCoursework', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
  })

  it('maps the assigned curriculum hierarchy in teaching order', async () => {
    mocks.curricula.mockResolvedValue({
      data: [
        {
          id: 'curriculum-id',
          version_number: 2,
          title: 'Foundation curriculum 2026',
          offering: { title: 'Design Entrance Foundation' },
        },
      ],
      error: null,
    })
    mocks.sections.mockResolvedValue({
      data: [
        {
          id: 'section-id',
          curriculum_version_id: 'curriculum-id',
          code: 'DRAWING',
          title: 'Drawing',
          description: 'Develop observation and visual communication.',
          position: 1,
        },
      ],
      error: null,
    })
    mocks.topics.mockResolvedValue({
      data: [
        {
          id: 'topic-id',
          section_id: 'section-id',
          code: 'PERSPECTIVE',
          title: 'Perspective',
          summary: 'Construct spaces with confidence.',
          position: 1,
        },
      ],
      error: null,
    })
    mocks.lessons.mockResolvedValue({
      data: [
        {
          id: 'lesson-id',
          topic_id: 'topic-id',
          code: 'ONE_POINT',
          title: 'One-point perspective',
          summary: null,
          body_markdown: 'Practice a simple interior.',
          position: 1,
        },
      ],
      error: null,
    })

    await expect(getStudentCoursework()).resolves.toEqual([
      {
        id: 'curriculum-id',
        versionNumber: 2,
        title: 'Foundation curriculum 2026',
        offeringTitle: 'Design Entrance Foundation',
        sections: [
          {
            id: 'section-id',
            code: 'DRAWING',
            title: 'Drawing',
            description: 'Develop observation and visual communication.',
            position: 1,
            topics: [
              {
                id: 'topic-id',
                code: 'PERSPECTIVE',
                title: 'Perspective',
                summary: 'Construct spaces with confidence.',
                position: 1,
                lessons: [
                  {
                    id: 'lesson-id',
                    code: 'ONE_POINT',
                    title: 'One-point perspective',
                    summary: null,
                    body: 'Practice a simple interior.',
                    position: 1,
                  },
                ],
              },
            ],
          },
        ],
      },
    ])
  })

  it('returns an empty list without making dependent queries', async () => {
    mocks.curricula.mockResolvedValue({ data: [], error: null })

    await expect(getStudentCoursework()).resolves.toEqual([])
    expect(mocks.sections).not.toHaveBeenCalled()
    expect(mocks.topics).not.toHaveBeenCalled()
    expect(mocks.lessons).not.toHaveBeenCalled()
  })

  it('fails closed when a curriculum row is incomplete', async () => {
    mocks.curricula.mockResolvedValue({
      data: [{ id: 'curriculum-id', title: 'Incomplete curriculum' }],
      error: null,
    })

    await expect(getStudentCoursework()).rejects.toThrow(
      'Your coursework could not be loaded. Please try again.',
    )
  })
})
