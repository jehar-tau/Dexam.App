import { getSupabaseClient } from '../auth/supabaseClient'

export type ContentStatus = 'draft' | 'published' | 'retired'

export type ContentLesson = {
  body: string
  code: string
  id: string
  position: number
  summary: string
  title: string
}

export type ContentTopic = {
  code: string
  id: string
  lessons: ContentLesson[]
  position: number
  sectionTitle: string
  summary: string
  title: string
}

export type ContentCurriculum = {
  id: string
  offeringId: string
  status: ContentStatus
  title: string
  topics: ContentTopic[]
  versionNumber: number
}

export type AssignmentMaterial = {
  byteSize: number
  fileName: string
  id: string
  mimeType: string
  objectPath: string
  position: number
}

export type ContentAssignment = {
  code: string
  evaluationRubric: string
  groupName: string
  id: string
  instructions: string
  materials: AssignmentMaterial[]
  offeringId: string
  status: ContentStatus
  title: string
  topicIds: string[]
  versionNumber: number
}

export type ContentOffering = {
  assignments: ContentAssignment[]
  curricula: ContentCurriculum[]
  id: string
  title: string
}

export const allowedMaterialTypes = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

export const maxMaterialBytes = 10 * 1024 * 1024
export const maxMaterialsPerAssignment = 5
const unavailableMessage =
  'The Content workspace could not be loaded. Check your access and try again.'
const saveFailedMessage = 'Your changes could not be saved. Check your access and try again.'

function clientOrThrow() {
  const client = getSupabaseClient()
  if (!client) throw new Error(unavailableMessage)
  return client
}

function rows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new Error(unavailableMessage)
  return value as Record<string, unknown>[]
}

function text(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function number(value: unknown, fallback = 0) {
  return typeof value === 'number' ? value : fallback
}

function status(value: unknown): ContentStatus {
  if (value === 'draft' || value === 'published' || value === 'retired') return value
  throw new Error(unavailableMessage)
}

export async function getContentWorkspace(): Promise<ContentOffering[]> {
  const client = clientOrThrow()
  const [offeringResult, curriculumResult, sectionResult, topicResult, lessonResult] =
    await Promise.all([
      client.from('offerings').select('id, title').order('title'),
      client
        .from('curriculum_versions')
        .select('id, offering_id, version_number, status, title')
        .order('version_number', { ascending: false }),
      client
        .from('curriculum_sections')
        .select('id, curriculum_version_id, title, position')
        .order('position'),
      client
        .from('curriculum_topics')
        .select('id, section_id, code, title, summary, position')
        .order('position'),
      client
        .from('curriculum_lessons')
        .select('id, topic_id, code, title, summary, body_markdown, position')
        .order('position'),
    ])

  if (
    offeringResult.error ||
    curriculumResult.error ||
    sectionResult.error ||
    topicResult.error ||
    lessonResult.error
  ) {
    throw new Error(unavailableMessage)
  }

  const [definitionResult, versionResult, linkResult, materialResult] = await Promise.all([
    client.from('assignment_definitions').select('id, offering_id, code'),
    client
      .from('assignment_versions')
      .select(
        'id, assignment_definition_id, version_number, status, group_name, title, instructions, evaluation_rubric',
      )
      .order('version_number', { ascending: false }),
    client.from('assignment_topic_links').select('assignment_version_id, topic_id'),
    client
      .from('assignment_materials')
      .select(
        'id, assignment_version_id, object_path, original_file_name, mime_type, byte_size, position',
      )
      .order('position'),
  ])

  if (definitionResult.error || versionResult.error || linkResult.error || materialResult.error) {
    throw new Error(unavailableMessage)
  }

  const sections = rows(sectionResult.data)
  const topics = rows(topicResult.data)
  const lessons = rows(lessonResult.data)
  const definitions = rows(definitionResult.data)
  const versions = rows(versionResult.data)
  const links = rows(linkResult.data)
  const materials = rows(materialResult.data)

  return rows(offeringResult.data).map((offering) => {
    const offeringId = text(offering.id)
    const curricula = rows(curriculumResult.data)
      .filter((curriculum) => curriculum.offering_id === offeringId)
      .map((curriculum): ContentCurriculum => {
        const curriculumId = text(curriculum.id)
        const curriculumSections = sections.filter(
          (section) => section.curriculum_version_id === curriculumId,
        )
        return {
          id: curriculumId,
          offeringId,
          status: status(curriculum.status),
          title: text(curriculum.title),
          versionNumber: number(curriculum.version_number),
          topics: curriculumSections.flatMap((section) =>
            topics
              .filter((topic) => topic.section_id === section.id)
              .map((topic): ContentTopic => ({
                id: text(topic.id),
                code: text(topic.code),
                title: text(topic.title),
                summary: text(topic.summary),
                position: number(topic.position),
                sectionTitle: text(section.title),
                lessons: lessons
                  .filter((lesson) => lesson.topic_id === topic.id)
                  .map((lesson): ContentLesson => ({
                    id: text(lesson.id),
                    code: text(lesson.code),
                    title: text(lesson.title),
                    summary: text(lesson.summary),
                    body: text(lesson.body_markdown),
                    position: number(lesson.position),
                  })),
              })),
          ),
        }
      })

    const offeringDefinitions = definitions.filter(
      (definition) => definition.offering_id === offeringId,
    )
    const assignments = offeringDefinitions.flatMap((definition) =>
      versions
        .filter((version) => version.assignment_definition_id === definition.id)
        .map((version): ContentAssignment => {
          const versionId = text(version.id)
          return {
            id: versionId,
            offeringId,
            code: text(definition.code),
            versionNumber: number(version.version_number),
            status: status(version.status),
            groupName: text(version.group_name),
            title: text(version.title),
            instructions: text(version.instructions),
            evaluationRubric: text(version.evaluation_rubric),
            topicIds: links
              .filter((link) => link.assignment_version_id === versionId)
              .map((link) => text(link.topic_id)),
            materials: materials
              .filter((material) => material.assignment_version_id === versionId)
              .map((material): AssignmentMaterial => ({
                id: text(material.id),
                objectPath: text(material.object_path),
                fileName: text(material.original_file_name),
                mimeType: text(material.mime_type),
                byteSize: number(material.byte_size),
                position: number(material.position),
              })),
          }
        }),
    )

    return { id: offeringId, title: text(offering.title), curricula, assignments }
  })
}

export async function cloneCurriculumVersion(sourceId: string, title: string) {
  const rawResult: unknown = await clientOrThrow().rpc('clone_curriculum_version', {
    p_source_curriculum_version_id: sourceId,
    p_title: title.trim(),
  })
  const { data, error } = rawResult as { data?: unknown; error?: unknown }
  if (error || typeof data !== 'string') throw new Error(saveFailedMessage)
  return data
}

export async function saveTopicDraft(topic: Pick<ContentTopic, 'id' | 'summary' | 'title'>) {
  const { error } = await clientOrThrow()
    .from('curriculum_topics')
    .update({ title: topic.title.trim(), summary: topic.summary.trim() || null })
    .eq('id', topic.id)
  if (error) throw new Error(saveFailedMessage)
}

export async function saveLessonDraft(
  lesson: Pick<ContentLesson, 'body' | 'id' | 'summary' | 'title'>,
) {
  const { error } = await clientOrThrow()
    .from('curriculum_lessons')
    .update({
      title: lesson.title.trim(),
      summary: lesson.summary.trim() || null,
      body_markdown: lesson.body.trim() || null,
    })
    .eq('id', lesson.id)
  if (error) throw new Error(saveFailedMessage)
}

export type NewAssignmentDraft = {
  code: string
  evaluationRubric: string
  groupName: string
  instructions: string
  offeringId: string
  title: string
  topicId: string
}

export async function createAssignmentDraft(input: NewAssignmentDraft) {
  const rawResult: unknown = await clientOrThrow().rpc('create_assignment_draft', {
    p_offering_id: input.offeringId,
    p_topic_id: input.topicId,
    p_code: input.code.trim().toUpperCase(),
    p_group_name: input.groupName.trim(),
    p_title: input.title.trim(),
    p_instructions: input.instructions.trim(),
    p_evaluation_rubric: input.evaluationRubric.trim(),
  })
  const { data, error } = rawResult as { data?: unknown; error?: unknown }
  if (error || typeof data !== 'string') throw new Error(saveFailedMessage)
  return data
}

export async function saveAssignmentDraft(
  assignment: Pick<
    ContentAssignment,
    'evaluationRubric' | 'groupName' | 'id' | 'instructions' | 'title'
  >,
) {
  const { error } = await clientOrThrow()
    .from('assignment_versions')
    .update({
      group_name: assignment.groupName.trim(),
      title: assignment.title.trim(),
      instructions: assignment.instructions.trim(),
      evaluation_rubric: assignment.evaluationRubric.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', assignment.id)
  if (error) throw new Error(saveFailedMessage)
}

export async function cloneAssignmentVersion(sourceId: string) {
  const rawResult: unknown = await clientOrThrow().rpc('clone_assignment_version', {
    p_source_assignment_version_id: sourceId,
  })
  const { data, error } = rawResult as { data?: unknown; error?: unknown }
  if (error || typeof data !== 'string') throw new Error(saveFailedMessage)
  return data
}

export async function publishCurriculumVersion(id: string, releaseNote: string) {
  const { error } = await clientOrThrow().rpc('publish_curriculum_version', {
    p_curriculum_version_id: id,
    p_release_note: releaseNote.trim(),
  })
  if (error) throw new Error('The curriculum could not be published. Review it and try again.')
}

export async function publishAssignmentVersion(id: string, releaseNote: string) {
  const { error } = await clientOrThrow().rpc('publish_assignment_version', {
    p_assignment_version_id: id,
    p_release_note: releaseNote.trim(),
  })
  if (error) throw new Error('The assignment could not be published. Review it and try again.')
}

export function validateMaterialFile(file: Pick<File, 'name' | 'size' | 'type'>, count: number) {
  if (count >= maxMaterialsPerAssignment)
    return 'Remove a file before adding another. The limit is 5.'
  if (!allowedMaterialTypes.includes(file.type as (typeof allowedMaterialTypes)[number])) {
    return 'Choose a PDF, JPEG, PNG, or WebP file.'
  }
  if (file.size < 1 || file.size > maxMaterialBytes)
    return 'Each file must be between 1 byte and 10 MB.'
  const expected =
    file.type === 'application/pdf'
      ? /\.pdf$/i
      : file.type === 'image/jpeg'
        ? /\.(jpg|jpeg)$/i
        : file.type === 'image/png'
          ? /\.png$/i
          : /\.webp$/i
  return expected.test(file.name) ? null : 'The file extension does not match its file type.'
}

export async function uploadAssignmentMaterial(
  offeringId: string,
  assignmentVersionId: string,
  file: File,
  currentCount: number,
) {
  const validationError = validateMaterialFile(file, currentCount)
  if (validationError) throw new Error(validationError)

  const client = clientOrThrow()
  const extension =
    file.type === 'application/pdf'
      ? 'pdf'
      : file.type === 'image/jpeg'
        ? 'jpg'
        : file.type === 'image/png'
          ? 'png'
          : 'webp'
  const objectPath = `${offeringId}/${assignmentVersionId}/${crypto.randomUUID()}.${extension}`
  const upload = await client.storage
    .from('assignment-materials')
    .upload(objectPath, file, { contentType: file.type, upsert: false })
  if (upload.error) throw new Error('The file could not be uploaded. Check it and try again.')

  const personResult = await client.rpc('current_person_id')
  if (personResult.error || typeof personResult.data !== 'string') {
    await client.storage.from('assignment-materials').remove([objectPath])
    throw new Error('The file could not be attached. Check your access and try again.')
  }

  const metadata = await client.from('assignment_materials').insert({
    assignment_version_id: assignmentVersionId,
    object_path: objectPath,
    original_file_name: file.name,
    mime_type: file.type,
    byte_size: file.size,
    position: currentCount + 1,
    created_by_person_id: personResult.data,
  })
  if (metadata.error) {
    await client.storage.from('assignment-materials').remove([objectPath])
    throw new Error('The file could not be attached. Check your access and try again.')
  }
}
