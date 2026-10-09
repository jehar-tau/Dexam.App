import { useQuery, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { Badge, Button, Callout, Card, EmptyState, Input } from '../components'
import {
  cloneAssignmentVersion,
  cloneCurriculumVersion,
  type ContentAssignment,
  type ContentCurriculum,
  type ContentLesson,
  type ContentOffering,
  type ContentTopic,
  createAssignmentDraft,
  getContentWorkspace,
  publishAssignmentVersion,
  publishCurriculumVersion,
  saveAssignmentDraft,
  saveLessonDraft,
  saveTopicDraft,
  uploadAssignmentMaterial,
  validateMaterialFile,
} from '../features/content/contentWorkspace'
import styles from './ContentWorkspacePage.module.css'

const previewOffering: ContentOffering = {
  id: 'preview-offering-foundation',
  title: 'Design Entrance Foundation',
  curricula: [
    {
      id: 'preview-curriculum-draft',
      offeringId: 'preview-offering-foundation',
      status: 'draft',
      title: 'Foundation curriculum 2027',
      versionNumber: 2,
      topics: [
        {
          id: 'preview-topic-lines',
          code: 'LINES_OVALS_CIRCLES',
          title: 'Lines, ovals & circles',
          summary: 'Develop confident strokes and control before constructing complex forms.',
          sectionTitle: 'Drawing',
          position: 1,
          lessons: [],
        },
        {
          id: 'preview-topic-perspective',
          code: 'PERSPECTIVE',
          title: 'Perspective',
          summary: 'Construct believable objects and spaces using vanishing points and a horizon.',
          sectionTitle: 'Drawing',
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
          ],
        },
        {
          id: 'preview-topic-storyboarding',
          code: 'STORYBOARDING',
          title: 'Storyboarding',
          summary: 'Communicate action, time, and cause-and-effect through a sequence of frames.',
          sectionTitle: 'Drawing',
          position: 3,
          lessons: [],
        },
        {
          id: 'preview-topic-spatial',
          code: 'SPATIAL',
          title: 'Spatial reasoning',
          summary: 'Read rotations, folds, views, and relationships between forms.',
          sectionTitle: 'Aptitude',
          position: 1,
          lessons: [],
        },
      ],
    },
  ],
  assignments: [
    {
      id: 'preview-assignment-draft',
      offeringId: 'preview-offering-foundation',
      code: 'PERSPECTIVE_ROOM',
      versionNumber: 2,
      status: 'draft',
      groupName: 'Perspective & objects',
      title: 'Draw a one-point perspective room',
      instructions:
        'Draw one interior using a clear horizon and a single vanishing point. Include at least five objects at different depths.',
      evaluationRubric:
        'Check convergence, proportion, line confidence, depth cues, and overall composition.',
      topicIds: ['preview-topic-perspective'],
      materials: [
        {
          id: 'preview-material-one',
          objectPath: 'preview/room-reference.pdf',
          fileName: 'room-reference.pdf',
          mimeType: 'application/pdf',
          byteSize: 843210,
          position: 1,
        },
      ],
    },
  ],
}

type EditorTab = 'material' | 'assignments'

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.ceil(bytes / 1024)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function TopicEditor({ preview, topic }: { preview: boolean; topic: ContentTopic }) {
  const [title, setTitle] = useState(topic.title)
  const [summary, setSummary] = useState(topic.summary)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')
    setSaving(true)
    try {
      if (!preview) await saveTopicDraft({ id: topic.id, title, summary })
      setNotice('Topic material saved to this draft.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'The topic could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.editorStack}>
      <form className={styles.form} onSubmit={(event) => void handleSave(event)}>
        <div className={styles.formHeading}>
          <div>
            <p className="eyebrow">Topic material</p>
            <h2>Edit what students will see</h2>
          </div>
          <Badge tone="accent">Draft only</Badge>
        </div>
        <Input
          label="Topic title"
          maxLength={160}
          onChange={(event) => setTitle(event.target.value)}
          required
          value={title}
        />
        <label className={styles.field}>
          <span>Topic introduction</span>
          <textarea
            maxLength={2000}
            onChange={(event) => setSummary(event.target.value)}
            rows={4}
            value={summary}
          />
          <small>Keep this short and useful. Students see it before the lesson material.</small>
        </label>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className={styles.success} role="status">
            {notice}
          </p>
        ) : null}
        <div className={styles.formActions}>
          <Button disabled={saving || title.trim().length < 2} type="submit">
            {saving ? 'Saving…' : 'Save topic changes'}
          </Button>
        </div>
      </form>

      {topic.lessons.length > 0 ? (
        topic.lessons.map((lesson) => (
          <LessonEditor key={lesson.id} lesson={lesson} preview={preview} />
        ))
      ) : (
        <EmptyState
          icon="✦"
          title="No lesson notes yet"
          description="This topic can still have assignments. Lesson creation and ordering comes in the next content-authoring increment."
        />
      )}
    </div>
  )
}

function LessonEditor({ lesson, preview }: { lesson: ContentLesson; preview: boolean }) {
  const [title, setTitle] = useState(lesson.title)
  const [summary, setSummary] = useState(lesson.summary)
  const [body, setBody] = useState(lesson.body)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setState('saving')
    try {
      if (!preview) await saveLessonDraft({ id: lesson.id, title, summary, body })
      setState('saved')
    } catch {
      setState('error')
    }
  }

  return (
    <Card className={styles.lessonCard}>
      <form className={styles.form} onSubmit={(event) => void handleSave(event)}>
        <div className={styles.formHeading}>
          <div>
            <p className="eyebrow">Lesson {lesson.position}</p>
            <h3>{lesson.code.replaceAll('_', ' ')}</h3>
          </div>
        </div>
        <Input
          label="Lesson title"
          onChange={(event) => setTitle(event.target.value)}
          required
          value={title}
        />
        <label className={styles.field}>
          <span>Short summary</span>
          <textarea onChange={(event) => setSummary(event.target.value)} rows={2} value={summary} />
        </label>
        <label className={styles.field}>
          <span>Lesson material</span>
          <textarea onChange={(event) => setBody(event.target.value)} rows={7} value={body} />
          <small>
            Text-first material stays searchable, accessible, and inexpensive to deliver.
          </small>
        </label>
        {state === 'saved' ? (
          <p className={styles.success} role="status">
            Lesson material saved.
          </p>
        ) : null}
        {state === 'error' ? (
          <p className={styles.error} role="alert">
            The lesson could not be saved.
          </p>
        ) : null}
        <div className={styles.formActions}>
          <Button disabled={state === 'saving'} type="submit" variant="secondary">
            {state === 'saving' ? 'Saving…' : 'Save lesson material'}
          </Button>
        </div>
      </form>
    </Card>
  )
}

function AssignmentEditor({
  assignment,
  preview,
}: {
  assignment: ContentAssignment
  preview: boolean
}) {
  const queryClient = useQueryClient()
  const [groupName, setGroupName] = useState(assignment.groupName)
  const [title, setTitle] = useState(assignment.title)
  const [instructions, setInstructions] = useState(assignment.instructions)
  const [rubric, setRubric] = useState(assignment.evaluationRubric)
  const [releaseNote, setReleaseNote] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [working, setWorking] = useState(false)

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setWorking(true)
    setNotice('')
    setError('')
    try {
      if (!preview) {
        await saveAssignmentDraft({
          id: assignment.id,
          groupName,
          title,
          instructions,
          evaluationRubric: rubric,
        })
      }
      setNotice('Assignment draft saved.')
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : 'The assignment could not be saved.',
      )
    } finally {
      setWorking(false)
    }
  }

  async function copyPublished() {
    setWorking(true)
    setError('')
    try {
      if (!preview) await cloneAssignmentVersion(assignment.id)
      setNotice('A new editable assignment version was created.')
      await queryClient.invalidateQueries({ queryKey: ['content-workspace'] })
    } catch (copyError) {
      setError(
        copyError instanceof Error ? copyError.message : 'The assignment could not be copied.',
      )
    } finally {
      setWorking(false)
    }
  }

  async function publish() {
    setWorking(true)
    setError('')
    try {
      if (!preview) await publishAssignmentVersion(assignment.id, releaseNote)
      setNotice('Assignment published as an immutable version.')
      await queryClient.invalidateQueries({ queryKey: ['content-workspace'] })
    } catch (publishError) {
      setError(
        publishError instanceof Error
          ? publishError.message
          : 'The assignment could not be published.',
      )
    } finally {
      setWorking(false)
    }
  }

  async function attach(file: File | undefined) {
    if (!file) return
    const validationError = validateMaterialFile(file, assignment.materials.length)
    if (validationError) {
      setError(validationError)
      return
    }
    setWorking(true)
    setError('')
    try {
      if (!preview) {
        await uploadAssignmentMaterial(
          assignment.offeringId,
          assignment.id,
          file,
          assignment.materials.length,
        )
      }
      setNotice(`${file.name} attached to this draft.`)
      await queryClient.invalidateQueries({ queryKey: ['content-workspace'] })
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : 'The file could not be attached.',
      )
    } finally {
      setWorking(false)
    }
  }

  if (assignment.status !== 'draft') {
    return (
      <Card className={styles.assignmentCard}>
        <div className={styles.formHeading}>
          <div>
            <p className="eyebrow">{assignment.groupName}</p>
            <h3>{assignment.title}</h3>
          </div>
          <Badge tone="success">Published · v{assignment.versionNumber}</Badge>
        </div>
        <p className={styles.muted}>
          Published assignments cannot be edited. Create a new version to make changes safely.
        </p>
        <Button disabled={working} onClick={() => void copyPublished()} variant="secondary">
          Create editable version
        </Button>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
      </Card>
    )
  }

  return (
    <Card className={styles.assignmentCard}>
      <form className={styles.form} onSubmit={(event) => void save(event)}>
        <div className={styles.formHeading}>
          <div>
            <p className="eyebrow">Assignment · {assignment.code}</p>
            <h3>Edit assignment version {assignment.versionNumber}</h3>
          </div>
          <Badge tone="accent">Draft</Badge>
        </div>
        <Input
          label="Assignment group"
          onChange={(event) => setGroupName(event.target.value)}
          required
          value={groupName}
        />
        <Input
          label="Assignment title"
          onChange={(event) => setTitle(event.target.value)}
          required
          value={title}
        />
        <label className={styles.field}>
          <span>Student instructions</span>
          <textarea
            onChange={(event) => setInstructions(event.target.value)}
            required
            rows={5}
            value={instructions}
          />
        </label>
        <label className={styles.field}>
          <span>Evaluation guide for teachers and future AI drafts</span>
          <textarea
            onChange={(event) => setRubric(event.target.value)}
            required
            rows={5}
            value={rubric}
          />
          <small>
            This rubric stays versioned with the assignment. AI feedback is not generated in this
            stage.
          </small>
        </label>
        <div className={styles.materials}>
          <div>
            <strong>Private assignment files</strong>
            <p>PDF, JPEG, PNG, or WebP · maximum 5 files · 10 MB each</p>
          </div>
          {assignment.materials.map((material) => (
            <div className={styles.materialRow} key={material.id}>
              <span>{material.fileName}</span>
              <small>{formatBytes(material.byteSize)}</small>
            </div>
          ))}
          <label className={styles.fileButton}>
            <span>Add private file</span>
            <input
              accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
              disabled={working || assignment.materials.length >= 5}
              onChange={(event) => void attach(event.target.files?.[0])}
              type="file"
            />
          </label>
        </div>
        {notice ? (
          <p className={styles.success} role="status">
            {notice}
          </p>
        ) : null}
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        <div className={styles.formActions}>
          <Button disabled={working} type="submit" variant="secondary">
            Save assignment draft
          </Button>
        </div>
      </form>
      <div className={styles.publishPanel}>
        <div>
          <strong>Ready to publish?</strong>
          <p>Publishing locks this version. Later changes start another draft.</p>
        </div>
        <Input
          label="Release note"
          onChange={(event) => setReleaseNote(event.target.value)}
          placeholder="What changed in this version?"
          value={releaseNote}
        />
        <Button disabled={working || releaseNote.trim().length < 3} onClick={() => void publish()}>
          Publish assignment
        </Button>
      </div>
    </Card>
  )
}

function NewAssignmentForm({
  offering,
  preview,
  topic,
}: {
  offering: ContentOffering
  preview: boolean
  topic: ContentTopic
}) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [groupName, setGroupName] = useState('')
  const [title, setTitle] = useState('')
  const [instructions, setInstructions] = useState('')
  const [rubric, setRubric] = useState('')
  const [error, setError] = useState('')
  const [created, setCreated] = useState(false)

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    try {
      if (!preview) {
        await createAssignmentDraft({
          offeringId: offering.id,
          topicId: topic.id,
          code,
          groupName,
          title,
          instructions,
          evaluationRubric: rubric,
        })
      }
      setCreated(true)
      setOpen(false)
      await queryClient.invalidateQueries({ queryKey: ['content-workspace'] })
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : 'The assignment could not be created.',
      )
    }
  }

  if (!open) {
    return (
      <div className={styles.newAssignment}>
        <div>
          <strong>{created ? 'Assignment draft created.' : 'Need another assignment?'}</strong>
          <p>New assignments start as private drafts linked to {topic.title}.</p>
        </div>
        <Button onClick={() => setOpen(true)}>New assignment</Button>
      </div>
    )
  }

  return (
    <Card className={styles.assignmentCard}>
      <form className={styles.form} onSubmit={(event) => void create(event)}>
        <div className={styles.formHeading}>
          <div>
            <p className="eyebrow">New assignment</p>
            <h3>Start a private draft</h3>
          </div>
          <Button onClick={() => setOpen(false)} size="sm" variant="ghost">
            Cancel
          </Button>
        </div>
        <Input
          hint="Uppercase letters, numbers, hyphens, and underscores."
          label="Internal code"
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          placeholder="PERSPECTIVE_STREET"
          required
          value={code}
        />
        <Input
          label="Assignment group"
          onChange={(event) => setGroupName(event.target.value)}
          placeholder="Perspective & objects"
          required
          value={groupName}
        />
        <Input
          label="Assignment title"
          onChange={(event) => setTitle(event.target.value)}
          required
          value={title}
        />
        <label className={styles.field}>
          <span>Student instructions</span>
          <textarea
            onChange={(event) => setInstructions(event.target.value)}
            required
            rows={4}
            value={instructions}
          />
        </label>
        <label className={styles.field}>
          <span>Evaluation guide</span>
          <textarea
            onChange={(event) => setRubric(event.target.value)}
            required
            rows={4}
            value={rubric}
          />
        </label>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit">Create assignment draft</Button>
      </form>
    </Card>
  )
}

function CurriculumRelease({
  curriculum,
  preview,
}: {
  curriculum: ContentCurriculum
  preview: boolean
}) {
  const queryClient = useQueryClient()
  const [releaseNote, setReleaseNote] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [working, setWorking] = useState(false)

  async function publish() {
    setWorking(true)
    setError('')
    try {
      if (!preview) await publishCurriculumVersion(curriculum.id, releaseNote)
      setNotice('Curriculum published as an immutable version.')
      await queryClient.invalidateQueries({ queryKey: ['content-workspace'] })
    } catch (publishError) {
      setError(
        publishError instanceof Error
          ? publishError.message
          : 'The curriculum could not be published.',
      )
    } finally {
      setWorking(false)
    }
  }

  return (
    <aside className={styles.releaseCard} aria-label="Curriculum release controls">
      <p className="eyebrow">Release controls</p>
      <h2>Publish curriculum</h2>
      <p>
        Preview the student view, describe the change, then lock version {curriculum.versionNumber}.
      </p>
      <Input
        label="Release note"
        onChange={(event) => setReleaseNote(event.target.value)}
        placeholder="What changed in this curriculum?"
        value={releaseNote}
      />
      <Button
        disabled={working || releaseNote.trim().length < 3}
        fullWidth
        onClick={() => void publish()}
      >
        Publish curriculum
      </Button>
      {notice ? (
        <p className={styles.success} role="status">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </aside>
  )
}

export function ContentWorkspacePage() {
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const preview =
    import.meta.env.VITE_ENABLE_OPERATOR_PREVIEW === 'true' && searchParams.get('preview') === '1'
  const [selectedTopicId, setSelectedTopicId] = useState('preview-topic-perspective')
  const [tab, setTab] = useState<EditorTab>('material')
  const [copyError, setCopyError] = useState('')

  const workspaceQuery = useQuery({
    queryKey: ['content-workspace', preview],
    queryFn: () => (preview ? Promise.resolve([previewOffering]) : getContentWorkspace()),
    retry: false,
  })

  if (workspaceQuery.isPending) {
    return (
      <section className={styles.state}>
        <p className="eyebrow">Staff content</p>
        <h1>Preparing the Content workspace…</h1>
        <p>Loading the academic versions you are allowed to manage.</p>
      </section>
    )
  }

  if (workspaceQuery.isError) {
    return (
      <section className={styles.state}>
        <p className="eyebrow">Staff content</p>
        <h1>The Content workspace could not be loaded.</h1>
        <Callout tone="warning" icon="warning">
          Your session remains protected. Check your connection and current permissions.
        </Callout>
        <Button onClick={() => void workspaceQuery.refetch()}>Try again</Button>
      </section>
    )
  }

  const offering = workspaceQuery.data[0]
  if (!offering) {
    return (
      <EmptyState
        title="No content access"
        description="No offering is currently assigned to your content-authoring permission."
      />
    )
  }

  const curriculum =
    offering.curricula.find((item) => item.status === 'draft') ?? offering.curricula[0]
  if (!curriculum) {
    return (
      <EmptyState
        title="No curriculum yet"
        description="A first curriculum will need to be created for this offering."
      />
    )
  }

  const topic =
    curriculum.topics.find((item) => item.id === selectedTopicId) ?? curriculum.topics[0]
  const assignments = topic
    ? offering.assignments.filter((assignment) => assignment.topicIds.includes(topic.id))
    : []
  const curriculumId = curriculum.id
  const curriculumTitle = curriculum.title

  async function createCurriculumDraft() {
    setCopyError('')
    try {
      if (!preview) await cloneCurriculumVersion(curriculumId, `${curriculumTitle} — next version`)
      await queryClient.invalidateQueries({ queryKey: ['content-workspace'] })
    } catch (error) {
      setCopyError(error instanceof Error ? error.message : 'The curriculum could not be copied.')
    }
  }

  return (
    <section className={styles.workspace} aria-labelledby="content-title">
      <header className={styles.pageHeader}>
        <div>
          <p className="eyebrow">
            Academic content · {preview ? 'Local preview' : 'Live workspace'}
          </p>
          <h1 id="content-title">Content workspace</h1>
          <p className={styles.lede}>
            Edit curriculum material and assignments safely before anything reaches students.
          </p>
        </div>
        <div className={styles.versionSummary}>
          <span>{offering.title}</span>
          <strong>{curriculum.title}</strong>
          <div>
            <Badge tone={curriculum.status === 'draft' ? 'accent' : 'success'}>
              {curriculum.status}
            </Badge>
            <span>Version {curriculum.versionNumber}</span>
          </div>
        </div>
      </header>

      {curriculum.status !== 'draft' ? (
        <Callout tone="neutral" icon="note">
          <strong>This version is published and locked.</strong>
          <span>Create an editable copy before changing student material.</span>
          <Button onClick={() => void createCurriculumDraft()} size="sm">
            Create editable curriculum
          </Button>
          {copyError ? <span role="alert">{copyError}</span> : null}
        </Callout>
      ) : null}

      {topic ? (
        <div className={styles.layout}>
          <aside className={styles.navigator} aria-label="Curriculum topics">
            <div className={styles.navigatorHeading}>
              <p className="eyebrow">Curriculum</p>
              <h2>Topics</h2>
            </div>
            {curriculum.topics.map((item) => (
              <button
                className={item.id === topic.id ? styles.selectedTopic : styles.topicButton}
                key={item.id}
                onClick={() => setSelectedTopicId(item.id)}
                type="button"
              >
                <span>{item.sectionTitle}</span>
                <strong>{item.title}</strong>
              </button>
            ))}
          </aside>

          <main className={styles.editor}>
            <div className={styles.topicHeader}>
              <div>
                <p className="eyebrow">
                  {topic.sectionTitle} · {topic.code}
                </p>
                <h2>{topic.title}</h2>
              </div>
              <div className={styles.tabs} role="tablist" aria-label="Content type">
                <button
                  aria-selected={tab === 'material'}
                  className={tab === 'material' ? styles.activeTab : ''}
                  onClick={() => setTab('material')}
                  role="tab"
                  type="button"
                >
                  Topic material
                </button>
                <button
                  aria-selected={tab === 'assignments'}
                  className={tab === 'assignments' ? styles.activeTab : ''}
                  onClick={() => setTab('assignments')}
                  role="tab"
                  type="button"
                >
                  Assignments <span>{assignments.length}</span>
                </button>
              </div>
            </div>

            {curriculum.status !== 'draft' ? (
              <Callout tone="neutral" icon="note">
                Published curriculum material is read-only. Create an editable copy to make changes.
              </Callout>
            ) : tab === 'material' ? (
              <TopicEditor key={topic.id} preview={preview} topic={topic} />
            ) : (
              <div className={styles.editorStack}>
                <NewAssignmentForm offering={offering} preview={preview} topic={topic} />
                {assignments.length ? (
                  assignments.map((assignment) => (
                    <AssignmentEditor
                      assignment={assignment}
                      key={assignment.id}
                      preview={preview}
                    />
                  ))
                ) : (
                  <EmptyState
                    title="No assignments for this topic"
                    description="Create the first assignment draft and define exactly how teachers should evaluate it."
                  />
                )}
              </div>
            )}
          </main>

          {curriculum.status === 'draft' ? (
            <CurriculumRelease curriculum={curriculum} preview={preview} />
          ) : null}
        </div>
      ) : (
        <EmptyState
          title="No topics yet"
          description="Topic creation will be added in the next content-authoring increment."
        />
      )}
    </section>
  )
}
