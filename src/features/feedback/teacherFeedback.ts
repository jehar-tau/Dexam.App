import { getSupabaseClient } from '../auth/supabaseClient'

export type FeedbackSourceKind = 'human' | 'dictation_assisted' | 'ai_proofread'
export type FeedbackOutcome = 'review_completed' | 'correction_requested'

export type FeedbackQueueItem = {
  aiAssisted: boolean
  assignmentGroup: string
  assignmentInstanceId: string
  assignmentTitle: string
  displayName: string
  feedbackRevisionId: string | null
  feedbackStatus: string | null
  memberId: string
  sourceKind: FeedbackSourceKind | null
  submissionAttemptId: string
  submissionFileCount: number
  submittedAt: string
  voiceEquivalentConfirmed: boolean
  writtenText: string
}

export type ReviewSubmissionFile = {
  id: string
  mimeType: string
  name: string
  signedUrl: string
}

type Row = Record<string, unknown>

const unavailableMessage = 'The feedback review workspace could not be loaded. Please try again.'

function clientOrThrow() {
  const client = getSupabaseClient()
  if (!client) throw new Error(unavailableMessage)
  return client
}

function text(value: unknown) {
  if (typeof value !== 'string') throw new Error(unavailableMessage)
  return value
}

function nullableText(value: unknown) {
  if (value === null || typeof value === 'string') return value
  throw new Error(unavailableMessage)
}

export async function getFeedbackReviewQueue(): Promise<FeedbackQueueItem[]> {
  const result = await clientOrThrow().rpc('list_feedback_review_queue')
  if (result.error || !Array.isArray(result.data)) throw new Error(unavailableMessage)
  return (result.data as Row[]).map((row) => ({
    assignmentInstanceId: text(row.assignment_instance_id),
    submissionAttemptId: text(row.submission_attempt_id),
    memberId: text(row.member_id),
    displayName: text(row.display_name),
    assignmentTitle: text(row.assignment_title),
    assignmentGroup: text(row.assignment_group),
    submittedAt: text(row.submitted_at),
    submissionFileCount: Number(row.submission_file_count),
    feedbackRevisionId: nullableText(row.feedback_revision_id),
    feedbackStatus: nullableText(row.feedback_status),
    writtenText: text(row.written_text ?? ''),
    sourceKind: nullableText(row.source_kind) as FeedbackSourceKind | null,
    voiceEquivalentConfirmed: row.voice_equivalent_confirmed === true,
    aiAssisted: row.ai_assisted === true,
  }))
}

export async function getReviewSubmissionFiles(
  submissionAttemptId: string,
): Promise<ReviewSubmissionFile[]> {
  const client = clientOrThrow()
  const result = await client
    .from('submission_files')
    .select('id, object_path, original_file_name, mime_type')
    .eq('submission_attempt_id', submissionAttemptId)
    .eq('status', 'ready')
    .is('purged_at', null)
    .order('position')
  if (result.error || !Array.isArray(result.data)) throw new Error(unavailableMessage)
  return Promise.all(
    (result.data as Row[]).map(async (row) => {
      const signed = await client.storage
        .from('student-submissions')
        .createSignedUrl(text(row.object_path), 15 * 60)
      if (signed.error) throw new Error(unavailableMessage)
      return {
        id: text(row.id),
        name: text(row.original_file_name),
        mimeType: text(row.mime_type),
        signedUrl: signed.data.signedUrl,
      }
    }),
  )
}

export async function startFeedbackDraft(submissionAttemptId: string) {
  const result = await clientOrThrow().rpc('start_feedback_draft', {
    p_submission_attempt_id: submissionAttemptId,
  })
  if (result.error || typeof result.data !== 'string') {
    throw new Error('A protected feedback draft could not be opened. Please try again.')
  }
  return result.data
}

export async function saveFeedbackDraft(input: {
  revisionId: string
  sourceKind: FeedbackSourceKind
  voiceEquivalentConfirmed: boolean
  writtenText: string
}) {
  const result = await clientOrThrow().rpc('save_feedback_draft', {
    p_feedback_revision_id: input.revisionId,
    p_written_text: input.writtenText,
    p_source_kind: input.sourceKind,
    p_voice_equivalent_confirmed: input.voiceEquivalentConfirmed,
  })
  if (result.error) throw new Error('The feedback draft could not be saved. Please try again.')
}

export async function publishFeedback(input: {
  correctionReason: string | null
  outcome: FeedbackOutcome
  revisionId: string
}) {
  const result = await clientOrThrow().rpc('publish_feedback_revision', {
    p_feedback_revision_id: input.revisionId,
    p_outcome: input.outcome,
    p_correction_reason: input.correctionReason,
  })
  if (result.error)
    throw new Error('The feedback could not be published. Review every field and try again.')
}

export async function uploadFeedbackAudio(input: {
  durationSeconds: number
  file: File
  kind: 'voice_note' | 'dictation_temp'
  revisionId: string
}) {
  const body = new FormData()
  body.set('revisionId', input.revisionId)
  body.set('kind', input.kind)
  body.set('originalFileName', input.file.name || `${input.kind}.webm`)
  body.set('durationSeconds', String(input.durationSeconds))
  body.set('file', input.file)
  const result = await clientOrThrow().functions.invoke('feedback-audio-file', { body })
  if (result.error) throw new Error('The recording could not be uploaded. Please try again.')
  return result.data as { file: { id: string } }
}

export async function removeFeedbackAudio(fileId: string) {
  const result = await clientOrThrow().functions.invoke('feedback-audio-file', {
    body: { fileId },
    method: 'DELETE',
  })
  if (result.error) throw new Error('The recording could not be removed. Please try again.')
}

export async function requestProofreading(revisionId: string, inputText: string) {
  const result = await clientOrThrow().rpc('request_feedback_assistance', {
    p_feedback_revision_id: revisionId,
    p_kind: 'proofread',
    p_audio_file_id: null,
    p_input_text: inputText,
  })
  if (result.error) {
    throw new Error('AI proofreading is not activated yet. Your original writing has not changed.')
  }
  return result.data as string
}

export async function requestTranscription(revisionId: string, audioFileId: string) {
  const result = await clientOrThrow().rpc('request_feedback_assistance', {
    p_feedback_revision_id: revisionId,
    p_kind: 'transcription',
    p_audio_file_id: audioFileId,
    p_input_text: null,
  })
  if (result.error) {
    throw new Error(
      'Voice transcription is not activated yet. The temporary recording was not published.',
    )
  }
  return result.data as string
}
