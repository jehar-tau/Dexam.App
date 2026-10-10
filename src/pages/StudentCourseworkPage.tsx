import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'

import { Badge, Button, Callout, Card, EmptyState } from '../components'
import {
  getStudentCoursework,
  type CurriculumSection,
  type CurriculumTopic,
  type StudentCurriculum,
} from '../features/student/getStudentCoursework'
import styles from './StudentCourseworkPage.module.css'

const previewCoursework: StudentCurriculum[] = [
  {
    id: 'preview-curriculum-foundation',
    offeringTitle: 'Design Entrance Foundation',
    title: 'Foundation curriculum 2026',
    versionNumber: 1,
    sections: [
      {
        id: 'preview-section-drawing',
        code: 'DRAWING',
        title: 'Drawing',
        description: 'Build observation, form, space, composition, and visual storytelling skills.',
        position: 1,
        topics: [
          {
            id: 'preview-topic-lines',
            code: 'LINES_OVALS_CIRCLES',
            title: 'Lines, ovals & circles',
            summary: 'Develop confident strokes and control before constructing complex forms.',
            position: 1,
            lessons: [
              {
                id: 'preview-lesson-line-control',
                code: 'LINE_CONTROL',
                title: 'Line control',
                summary: 'Warm up with straight lines, curves, and repeated marks.',
                body: 'Work from the shoulder, maintain even pressure, and prefer one confident stroke over several uncertain strokes.',
                position: 1,
              },
            ],
          },
          {
            id: 'preview-topic-perspective',
            code: 'PERSPECTIVE',
            title: 'Perspective',
            summary:
              'Construct believable objects and spaces using vanishing points and a horizon.',
            position: 2,
            lessons: [
              {
                id: 'preview-lesson-one-point',
                code: 'ONE_POINT',
                title: 'One-point perspective',
                summary: 'Use one vanishing point to construct frontal spaces.',
                body: 'Identify the horizon first. Keep front-facing edges horizontal and vertical, then guide depth lines toward the same vanishing point.',
                position: 1,
              },
              {
                id: 'preview-lesson-two-point',
                code: 'TWO_POINT',
                title: 'Two-point perspective',
                summary: 'Turn objects in space using two vanishing points.',
                body: 'Begin with the nearest vertical edge. Send each horizontal plane toward its corresponding vanishing point.',
                position: 2,
              },
              {
                id: 'preview-lesson-three-point',
                code: 'THREE_POINT',
                title: 'Three-point perspective',
                summary: 'Create convincing high and low viewpoints.',
                body: 'Add a third vanishing point above or below the horizon to control vertical convergence.',
                position: 3,
              },
            ],
          },
          {
            id: 'preview-topic-storyboarding',
            code: 'STORYBOARDING',
            title: 'Storyboarding',
            summary: 'Communicate action, time, and cause-and-effect through a sequence of frames.',
            position: 3,
            lessons: [],
          },
        ],
      },
      {
        id: 'preview-section-aptitude',
        code: 'APTITUDE',
        title: 'Aptitude',
        description:
          'Strengthen spatial, visual, logical, analytical, and general awareness skills.',
        position: 2,
        topics: [
          {
            id: 'preview-topic-spatial',
            code: 'SPATIAL',
            title: 'Spatial reasoning',
            summary: 'Read rotations, folds, views, and relationships between forms.',
            position: 1,
            lessons: [],
          },
          {
            id: 'preview-topic-observation',
            code: 'VISUAL_OBSERVATION',
            title: 'Visual observation',
            summary: 'Notice patterns, differences, figure relationships, and visual evidence.',
            position: 2,
            lessons: [],
          },
          {
            id: 'preview-topic-lateral',
            code: 'LATERAL_THINKING',
            title: 'Lateral thinking',
            summary: 'Reframe unfamiliar problems and test more than one plausible approach.',
            position: 3,
            lessons: [],
          },
        ],
      },
    ],
  },
]

type SelectedTopic = {
  curriculum: StudentCurriculum
  section: CurriculumSection
  topic: CurriculumTopic
}

function findTopic(
  curricula: StudentCurriculum[],
  requestedId: string | null,
): SelectedTopic | null {
  let firstTopic: SelectedTopic | null = null

  for (const curriculum of curricula) {
    for (const section of curriculum.sections) {
      for (const topic of section.topics) {
        const candidate = { curriculum, section, topic }
        firstTopic ??= candidate
        if (topic.id === requestedId) return candidate
      }
    }
  }

  return firstTopic
}

export function StudentCourseworkPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const previewEnabled =
    import.meta.env.VITE_ENABLE_STUDENT_PREVIEW === 'true' && searchParams.get('preview') === '1'
  const courseworkQuery = useQuery({
    queryKey: ['student-coursework', previewEnabled],
    queryFn: () => (previewEnabled ? Promise.resolve(previewCoursework) : getStudentCoursework()),
    retry: false,
  })

  if (courseworkQuery.isPending) {
    return (
      <section className={styles.state} aria-live="polite">
        <p className="eyebrow">Student coursework</p>
        <h1>Preparing your curriculum…</h1>
        <p>We are loading the topics assigned to your current enrolment.</p>
      </section>
    )
  }

  if (courseworkQuery.isError) {
    return (
      <section className={styles.state} aria-labelledby="coursework-error-title">
        <p className="eyebrow">Student coursework</p>
        <h1 id="coursework-error-title">Your coursework could not be loaded.</h1>
        <Callout tone="warning" icon="warning">
          Check your connection and try again. Only your assigned curriculum can be shown here.
        </Callout>
        <Button onClick={() => void courseworkQuery.refetch()}>Try again</Button>
      </section>
    )
  }

  const curricula = courseworkQuery.data
  const selected = findTopic(curricula, searchParams.get('topic'))
  const workspaceUrl = previewEnabled ? '/student?preview=1' : '/student'

  if (!selected) {
    return (
      <section className={styles.coursework} aria-labelledby="coursework-title">
        <Link className={styles.backLink} to={workspaceUrl}>
          ← Student workspace
        </Link>
        <div className={styles.pageHeader}>
          <p className="eyebrow">Student coursework</p>
          <h1 id="coursework-title">Your coursework.</h1>
          <p>No curriculum has been assigned to your active enrolment yet.</p>
        </div>
        <EmptyState
          icon="○"
          title="Coursework is not available yet"
          description="When Dexam publishes and assigns your curriculum, its topics will appear here automatically."
        />
      </section>
    )
  }

  function selectTopic(topicId: string) {
    const next = new URLSearchParams(searchParams)
    next.set('topic', topicId)
    setSearchParams(next)
  }

  const topicCount = curricula.reduce(
    (curriculumTotal, curriculum) =>
      curriculumTotal +
      curriculum.sections.reduce(
        (sectionTotal, section) => sectionTotal + section.topics.length,
        0,
      ),
    0,
  )

  return (
    <section className={styles.coursework} aria-labelledby="coursework-title">
      <Link className={styles.backLink} to={workspaceUrl}>
        ← Student workspace
      </Link>

      <header className={styles.pageHeader}>
        <div>
          <p className="eyebrow">
            Student coursework · {previewEnabled ? 'Local preview' : 'Live account'}
          </p>
          <h1 id="coursework-title">Your coursework.</h1>
          <p className={styles.lede}>
            Browse the published topics and lesson notes assigned to your current enrolment.
          </p>
        </div>
        <dl className={styles.overview} aria-label="Curriculum overview">
          <div>
            <dt>Programme</dt>
            <dd>{selected.curriculum.offeringTitle}</dd>
          </div>
          <div>
            <dt>Topics</dt>
            <dd>{topicCount}</dd>
          </div>
          <div>
            <dt>Version</dt>
            <dd>{selected.curriculum.versionNumber}</dd>
          </div>
        </dl>
      </header>

      <div className={styles.browser}>
        <aside className={styles.navigator} aria-label="Coursework topics">
          {curricula.map((curriculum) => (
            <div className={styles.curriculumGroup} key={curriculum.id}>
              <div className={styles.curriculumHeading}>
                <p>{curriculum.title}</p>
                <Badge pill tone="success">
                  Published
                </Badge>
              </div>
              {curriculum.sections.map((section) => (
                <div className={styles.sectionGroup} key={section.id}>
                  <div className={styles.sectionHeading}>
                    <h2>{section.title}</h2>
                    <span>{section.topics.length}</span>
                  </div>
                  {section.description ? <p>{section.description}</p> : null}
                  <div className={styles.topicList}>
                    {section.topics.map((topic) => (
                      <button
                        aria-pressed={topic.id === selected.topic.id}
                        className={
                          topic.id === selected.topic.id ? styles.selectedTopic : styles.topicButton
                        }
                        key={topic.id}
                        onClick={() => selectTopic(topic.id)}
                        type="button"
                      >
                        <span>{String(topic.position).padStart(2, '0')}</span>
                        <strong>{topic.title}</strong>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </aside>

        <article className={styles.topicDetail} aria-labelledby="selected-topic-title">
          <div className={styles.topicHeader}>
            <div className={styles.topicMeta}>
              <Badge tone="accent">{selected.section.title}</Badge>
              <span>
                {selected.topic.lessons.length}{' '}
                {selected.topic.lessons.length === 1 ? 'lesson' : 'lessons'}
              </span>
            </div>
            <h2 id="selected-topic-title">{selected.topic.title}</h2>
            <p>
              {selected.topic.summary ??
                'Your teacher will add guidance for this published curriculum topic.'}
            </p>
          </div>

          {selected.topic.lessons.length === 0 ? (
            <Callout tone="neutral">
              This topic is part of your curriculum. Detailed lesson notes are still being prepared.
            </Callout>
          ) : (
            <div className={styles.lessonList} aria-label={`${selected.topic.title} lessons`}>
              {selected.topic.lessons.map((lesson) => (
                <Card className={styles.lessonCard} key={lesson.id}>
                  <div className={styles.lessonNumber} aria-hidden="true">
                    {String(lesson.position).padStart(2, '0')}
                  </div>
                  <div>
                    <h3>{lesson.title}</h3>
                    {lesson.summary ? (
                      <p className={styles.lessonSummary}>{lesson.summary}</p>
                    ) : null}
                    {lesson.body ? <p className={styles.lessonBody}>{lesson.body}</p> : null}
                  </div>
                </Card>
              ))}
            </div>
          )}

          <Callout tone="neutral">
            Assignments and submissions will be added in the next product stage. This view currently
            covers the approved curriculum and lesson structure only.
          </Callout>
        </article>
      </div>
    </section>
  )
}
