import { getSupabaseClient } from '../auth/supabaseClient'

export type CurriculumLesson = {
  body: string | null
  code: string
  id: string
  position: number
  summary: string | null
  title: string
}

export type CurriculumTopic = {
  code: string
  id: string
  lessons: CurriculumLesson[]
  position: number
  summary: string | null
  title: string
}

export type CurriculumSection = {
  code: string
  description: string | null
  id: string
  position: number
  title: string
  topics: CurriculumTopic[]
}

export type StudentCurriculum = {
  id: string
  offeringTitle: string
  sections: CurriculumSection[]
  title: string
  versionNumber: number
}

type CurriculumRow = {
  id?: unknown
  offering?: unknown
  title?: unknown
  version_number?: unknown
}

type SectionRow = {
  code?: unknown
  curriculum_version_id?: unknown
  description?: unknown
  id?: unknown
  position?: unknown
  title?: unknown
}

type TopicRow = {
  code?: unknown
  id?: unknown
  position?: unknown
  section_id?: unknown
  summary?: unknown
  title?: unknown
}

type LessonRow = {
  body_markdown?: unknown
  code?: unknown
  id?: unknown
  position?: unknown
  summary?: unknown
  title?: unknown
  topic_id?: unknown
}

const unavailableMessage = 'Your coursework could not be loaded. Please try again.'

function nullableText(value: unknown) {
  return value === null || typeof value === 'string' ? value : undefined
}

function relatedTitle(value: unknown) {
  if (!value || typeof value !== 'object') return undefined
  const title = (value as Record<string, unknown>).title
  return typeof title === 'string' ? title : undefined
}

function isPosition(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

function parseCurriculum(row: CurriculumRow): Omit<StudentCurriculum, 'sections'> | null {
  const offeringTitle = relatedTitle(row.offering)
  if (
    typeof row.id !== 'string' ||
    typeof row.title !== 'string' ||
    !isPosition(row.version_number) ||
    typeof offeringTitle !== 'string'
  ) {
    return null
  }

  return {
    id: row.id,
    offeringTitle,
    title: row.title,
    versionNumber: row.version_number,
  }
}

function parseSection(
  row: SectionRow,
): (Omit<CurriculumSection, 'topics'> & { versionId: string }) | null {
  const description = nullableText(row.description)
  if (
    typeof row.id !== 'string' ||
    typeof row.curriculum_version_id !== 'string' ||
    typeof row.code !== 'string' ||
    typeof row.title !== 'string' ||
    description === undefined ||
    !isPosition(row.position)
  ) {
    return null
  }

  return {
    id: row.id,
    versionId: row.curriculum_version_id,
    code: row.code,
    title: row.title,
    description,
    position: row.position,
  }
}

function parseTopic(
  row: TopicRow,
): (Omit<CurriculumTopic, 'lessons'> & { sectionId: string }) | null {
  const summary = nullableText(row.summary)
  if (
    typeof row.id !== 'string' ||
    typeof row.section_id !== 'string' ||
    typeof row.code !== 'string' ||
    typeof row.title !== 'string' ||
    summary === undefined ||
    !isPosition(row.position)
  ) {
    return null
  }

  return {
    id: row.id,
    sectionId: row.section_id,
    code: row.code,
    title: row.title,
    summary,
    position: row.position,
  }
}

function parseLesson(row: LessonRow): (CurriculumLesson & { topicId: string }) | null {
  const summary = nullableText(row.summary)
  const body = nullableText(row.body_markdown)
  if (
    typeof row.id !== 'string' ||
    typeof row.topic_id !== 'string' ||
    typeof row.code !== 'string' ||
    typeof row.title !== 'string' ||
    summary === undefined ||
    body === undefined ||
    !isPosition(row.position)
  ) {
    return null
  }

  return {
    id: row.id,
    topicId: row.topic_id,
    code: row.code,
    title: row.title,
    summary,
    body,
    position: row.position,
  }
}

function parsedRows<T>(rows: unknown, parser: (row: never) => T | null): T[] {
  if (!Array.isArray(rows)) throw new Error(unavailableMessage)
  const parsed = rows.map((row) => parser(row as never))
  if (parsed.some((row) => row === null)) throw new Error(unavailableMessage)
  return parsed as T[]
}

export async function getStudentCoursework(): Promise<StudentCurriculum[]> {
  const client = getSupabaseClient()
  if (!client) throw new Error(unavailableMessage)

  const curriculumResult = await client
    .from('curriculum_versions')
    .select('id, version_number, title, offering:offerings(title)')
    .eq('status', 'published')
    .order('version_number', { ascending: false })

  if (curriculumResult.error) throw new Error(unavailableMessage)
  const curricula = parsedRows(curriculumResult.data, parseCurriculum)
  if (curricula.length === 0) return []

  const sectionResult = await client
    .from('curriculum_sections')
    .select('id, curriculum_version_id, code, title, description, position')
    .in(
      'curriculum_version_id',
      curricula.map((curriculum) => curriculum.id),
    )
    .order('position', { ascending: true })

  if (sectionResult.error) throw new Error(unavailableMessage)
  const sections = parsedRows(sectionResult.data, parseSection)
  if (sections.length === 0) throw new Error(unavailableMessage)

  const topicResult = await client
    .from('curriculum_topics')
    .select('id, section_id, code, title, summary, position')
    .in(
      'section_id',
      sections.map((section) => section.id),
    )
    .order('position', { ascending: true })

  if (topicResult.error) throw new Error(unavailableMessage)
  const topics = parsedRows(topicResult.data, parseTopic)
  if (topics.length === 0) throw new Error(unavailableMessage)

  const lessonResult = await client
    .from('curriculum_lessons')
    .select('id, topic_id, code, title, summary, body_markdown, position')
    .in(
      'topic_id',
      topics.map((topic) => topic.id),
    )
    .order('position', { ascending: true })

  if (lessonResult.error) throw new Error(unavailableMessage)
  const lessons = parsedRows(lessonResult.data, parseLesson)

  return curricula.map((curriculum) => ({
    ...curriculum,
    sections: sections
      .filter((section) => section.versionId === curriculum.id)
      .map((section) => ({
        id: section.id,
        code: section.code,
        title: section.title,
        description: section.description,
        position: section.position,
        topics: topics
          .filter((topic) => topic.sectionId === section.id)
          .map((topic) => ({
            id: topic.id,
            code: topic.code,
            title: topic.title,
            summary: topic.summary,
            position: topic.position,
            lessons: lessons
              .filter((lesson) => lesson.topicId === topic.id)
              .map((lesson) => ({
                id: lesson.id,
                code: lesson.code,
                title: lesson.title,
                summary: lesson.summary,
                body: lesson.body,
                position: lesson.position,
              })),
          })),
      })),
  }))
}
