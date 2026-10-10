import { useQuery, useQueryClient } from '@tanstack/react-query'
import { type ChangeEvent, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { Badge, Button, Callout, EmptyState } from '../components'
import {
  getFeedbackReviewQueue,
  getReviewSubmissionFiles,
  publishFeedback,
  requestProofreading,
  requestTranscription,
  saveFeedbackDraft,
  startFeedbackDraft,
  type FeedbackOutcome,
  type FeedbackQueueItem,
  type FeedbackSourceKind,
  type ReviewSubmissionFile,
  uploadFeedbackAudio,
} from '../features/feedback/teacherFeedback'
import styles from './TeacherFeedbackPage.module.css'

type RecordingTarget = 'written_dictation' | 'correction_dictation' | 'voice_note'

const previewQueue: FeedbackQueueItem[] = [
  {
    assignmentInstanceId: 'preview-instance-one',
    submissionAttemptId: 'preview-attempt-one',
    memberId: 'DXM-2K3M9Q2RW5TY',
    displayName: 'Aarohi Deshmukh',
    assignmentTitle: 'Line confidence practice',
    assignmentGroup: 'Drawing foundations',
    submittedAt: '2026-10-08T11:30:00.000Z',
    submissionFileCount: 1,
    feedbackRevisionId: null,
    feedbackStatus: null,
    writtenText: '',
    sourceKind: null,
    voiceEquivalentConfirmed: false,
    aiAssisted: false,
  },
  {
    assignmentInstanceId: 'preview-instance-two',
    submissionAttemptId: 'preview-attempt-two',
    memberId: 'DXM-3K3M9Q2RW5TY',
    displayName: 'Kabir Mehta',
    assignmentTitle: 'Draw a one-point perspective room',
    assignmentGroup: 'Perspective & Objects',
    submittedAt: '2026-10-09T09:15:00.000Z',
    submissionFileCount: 2,
    feedbackRevisionId: null,
    feedbackStatus: null,
    writtenText: '',
    sourceKind: null,
    voiceEquivalentConfirmed: false,
    aiAssisted: false,
  },
]

const previewDictation =
  'Your line control is improving and the circles are more confident. Keep the pressure consistent, especially through the longer curves.'
const previewCorrectionDictation =
  'Please repeat the final row with slower, continuous strokes and keep the pressure consistent from start to finish.'

const previewFiles: Record<string, ReviewSubmissionFile[]> = {
  'preview-attempt-one': [
    {
      id: 'preview-line-practice',
      mimeType: 'image/jpeg',
      name: 'line-practice.jpg',
      signedUrl: '/previews/line-practice-submission.svg',
    },
  ],
  'preview-attempt-two': [
    {
      id: 'preview-perspective-room',
      mimeType: 'image/jpeg',
      name: 'perspective-room.jpg',
      signedUrl: '/previews/perspective-room-submission.svg',
    },
    {
      id: 'preview-reference-sheet',
      mimeType: 'application/pdf',
      name: 'construction-notes.pdf',
      signedUrl: '/previews/line-practice-submission.svg',
    },
  ],
}

function previewProofread(value: string) {
  const normalized = value.trim().replace(/\s+/g, ' ')
  if (!normalized) return ''
  return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1).replace(/\bi\b/g, 'I')}${/[.!?]$/.test(normalized) ? '' : '.'}`
}

function submittedLabel(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value))
}

async function audioDuration(file: File) {
  return new Promise<number>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const audio = document.createElement('audio')
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      if (Number.isFinite(audio.duration) && audio.duration > 0) resolve(audio.duration)
      else reject(new Error('The recording duration could not be read.'))
    }
    audio.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('The recording could not be read.'))
    }
    audio.src = url
  })
}

export function TeacherFeedbackPage() {
  const [searchParams] = useSearchParams()
  const previewEnabled =
    import.meta.env.VITE_ENABLE_OPERATOR_PREVIEW === 'true' && searchParams.get('preview') === '1'
  const queryClient = useQueryClient()
  const queueQuery = useQuery({
    queryKey: ['feedback-review-queue'],
    queryFn: getFeedbackReviewQueue,
    enabled: !previewEnabled,
    retry: false,
  })
  const queue = previewEnabled ? previewQueue : (queueQuery.data ?? [])
  const [selectedAttemptId, setSelectedAttemptId] = useState(searchParams.get('attempt') ?? '')
  const [publishedAttempts, setPublishedAttempts] = useState<string[]>([])
  const visibleQueue = queue.filter((item) => !publishedAttempts.includes(item.submissionAttemptId))
  const requestedInstanceId = searchParams.get('instance')
  const selected =
    visibleQueue.find((item) => item.submissionAttemptId === selectedAttemptId) ??
    visibleQueue.find((item) => item.assignmentInstanceId === requestedInstanceId) ??
    visibleQueue[0] ??
    null
  const filesQuery = useQuery({
    queryKey: ['feedback-submission-files', selected?.submissionAttemptId],
    queryFn: () => getReviewSubmissionFiles(selected!.submissionAttemptId),
    enabled: Boolean(selected) && !previewEnabled,
    retry: false,
  })
  const [revisionId, setRevisionId] = useState<string | null>(null)
  const [writtenText, setWrittenText] = useState('')
  const [sourceKind, setSourceKind] = useState<FeedbackSourceKind>('human')
  const [voiceAttached, setVoiceAttached] = useState(false)
  const [voiceEquivalentConfirmed, setVoiceEquivalentConfirmed] = useState(false)
  const [proofreadOriginal, setProofreadOriginal] = useState('')
  const [proofreadSuggestion, setProofreadSuggestion] = useState('')
  const [correctionReason, setCorrectionReason] = useState('')
  const [correctionProofreadOriginal, setCorrectionProofreadOriginal] = useState('')
  const [correctionProofreadSuggestion, setCorrectionProofreadSuggestion] = useState('')
  const [expandedFile, setExpandedFile] = useState<ReviewSubmissionFile | null>(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [recordingTarget, setRecordingTarget] = useState<RecordingTarget | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recordingChunksRef = useRef<Blob[]>([])
  const recordingLimitRef = useRef<number | null>(null)

  useEffect(() => {
    if (!selected) return
    // The keyed review selection intentionally initializes one isolated private draft workspace.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRevisionId(selected.feedbackRevisionId)
    setWrittenText(selected.writtenText)
    setSourceKind(selected.sourceKind ?? 'human')
    setVoiceEquivalentConfirmed(selected.voiceEquivalentConfirmed)
    setVoiceAttached(false)
    setProofreadOriginal('')
    setProofreadSuggestion('')
    setCorrectionReason('')
    setCorrectionProofreadOriginal('')
    setCorrectionProofreadSuggestion('')
    setExpandedFile(null)
  }, [selected])

  useEffect(() => {
    if (!expandedFile) return
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setExpandedFile(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [expandedFile])

  async function ensureDraft() {
    if (!selected) throw new Error('Choose a submitted assignment first.')
    if (revisionId) return revisionId
    if (previewEnabled) {
      const id = `preview-feedback-${selected.submissionAttemptId}`
      setRevisionId(id)
      return id
    }
    const id = await startFeedbackDraft(selected.submissionAttemptId)
    setRevisionId(id)
    return id
  }

  async function saveDraft(
    nextText = writtenText,
    nextSource = sourceKind,
    nextVoiceConfirmed = voiceEquivalentConfirmed,
  ) {
    const id = await ensureDraft()
    if (!previewEnabled) {
      await saveFeedbackDraft({
        revisionId: id,
        writtenText: nextText,
        sourceKind: nextSource,
        voiceEquivalentConfirmed: nextVoiceConfirmed,
      })
    }
    return id
  }

  async function handleSave() {
    setError('')
    setNotice('')
    setBusy('Saving protected draft…')
    try {
      await saveDraft()
      setNotice('Private feedback draft saved. The student cannot see it yet.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The draft could not be saved.')
    } finally {
      setBusy('')
    }
  }

  async function processAudioFile(file: File, target: RecordingTarget, knownDuration?: number) {
    const kind = target === 'voice_note' ? 'voice_note' : 'dictation_temp'
    setError('')
    setNotice('')
    setBusy(kind === 'voice_note' ? 'Adding private voice feedback…' : 'Preparing dictation…')
    try {
      const duration = knownDuration ?? (await audioDuration(file))
      if (duration > 300 || file.size > 10 * 1024 * 1024) {
        throw new Error('Recordings must be 5 minutes or less and no larger than 10 MB.')
      }
      if (target === 'correction_dictation' && !previewEnabled) {
        throw new Error(
          'Correction-request transcription is not activated yet. No recording was uploaded or published.',
        )
      }
      const id = await saveDraft()
      if (!previewEnabled) {
        const uploaded = await uploadFeedbackAudio({
          revisionId: id,
          file,
          kind,
          durationSeconds: duration,
        })
        if (kind === 'dictation_temp') {
          await requestTranscription(id, uploaded.file.id)
          setNotice(
            'The dictation is queued. Its transcript will remain editable and private until you publish.',
          )
          return
        }
      }
      if (kind === 'voice_note') {
        setVoiceAttached(true)
        setNotice(
          'Voice feedback attached privately. Add and confirm the written equivalent before publishing.',
        )
      } else {
        setWrittenText(previewDictation)
        setSourceKind('dictation_assisted')
        setNotice('Dictation converted to editable writing. Review it before publishing.')
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The recording could not be processed.')
    } finally {
      setBusy('')
    }
  }

  async function handleAudioFile(event: ChangeEvent<HTMLInputElement>, target: RecordingTarget) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) await processAudioFile(file, target)
  }

  async function beginRecording(target: RecordingTarget) {
    setError('')
    setNotice('')
    if (recordingTarget && recordingTarget !== target) {
      setError('Stop the current recording before starting another one.')
      return
    }
    if (previewEnabled) {
      setRecordingTarget(target)
      return
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError(
        'Microphone recording is not supported in this browser. Upload an audio file instead.',
      )
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      recordingChunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordingChunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        if (recordingLimitRef.current !== null) window.clearTimeout(recordingLimitRef.current)
        recordingLimitRef.current = null
        stream.getTracks().forEach((track) => track.stop())
        const file = new File(recordingChunksRef.current, `${target}.webm`, {
          type: 'audio/webm',
        })
        void processAudioFile(file, target)
      }
      recorderRef.current = recorder
      recorder.start()
      setRecordingTarget(target)
      recordingLimitRef.current = window.setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop()
        setRecordingTarget(null)
      }, 300_000)
    } catch {
      setError('Microphone permission was not granted. You can upload an audio file instead.')
    }
  }

  function stopRecording() {
    if (recordingLimitRef.current !== null) window.clearTimeout(recordingLimitRef.current)
    recordingLimitRef.current = null
    if (previewEnabled) {
      if (recordingTarget === 'written_dictation') {
        setWrittenText(previewDictation)
        setSourceKind('dictation_assisted')
        setNotice('Dictation converted to editable writing. Review it before publishing.')
      } else if (recordingTarget === 'correction_dictation') {
        setCorrectionReason(previewCorrectionDictation)
        setNotice(
          'Correction dictation converted to editable writing. Review it before publishing.',
        )
      } else if (recordingTarget === 'voice_note') {
        setVoiceAttached(true)
        setNotice(
          'Voice feedback attached privately. Add and confirm the written equivalent before publishing.',
        )
      }
      setRecordingTarget(null)
      return
    }
    recorderRef.current?.stop()
    recorderRef.current = null
    setRecordingTarget(null)
  }

  async function proofread() {
    if (!writtenText.trim()) {
      setError('Add written feedback before asking for proofreading.')
      return
    }
    setError('')
    setNotice('')
    setBusy('Preparing a proofreading suggestion…')
    try {
      const id = await saveDraft()
      if (!previewEnabled) await requestProofreading(id, writtenText)
      setProofreadOriginal(writtenText)
      setProofreadSuggestion(previewEnabled ? previewProofread(writtenText) : '')
      if (!previewEnabled) {
        setNotice(
          'The request is queued. Your original writing remains unchanged until you accept a suggestion.',
        )
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Proofreading could not be requested.')
    } finally {
      setBusy('')
    }
  }

  function proofreadCorrection() {
    if (!correctionReason.trim()) {
      setError('Add a correction request before asking for proofreading.')
      return
    }
    setError('')
    setNotice('')
    if (!previewEnabled) {
      setError(
        'AI proofreading for correction requests is not activated yet. Your original writing has not changed.',
      )
      return
    }
    setCorrectionProofreadOriginal(correctionReason)
    setCorrectionProofreadSuggestion(previewProofread(correctionReason))
  }

  const displayedFiles = selected
    ? previewEnabled
      ? (previewFiles[selected.submissionAttemptId] ?? [])
      : (filesQuery.data ?? [])
    : []

  function recordingStatus(target: RecordingTarget, label: string) {
    if (recordingTarget !== target) return null
    return (
      <Callout tone="warning" icon="warning">
        <div className={styles.recording} role="status">
          <span className={styles.listeningDot} aria-hidden="true" />
          <strong>Microphone active</strong>
          <span>Listening for {label}… maximum 5 minutes.</span>
          <Button onClick={stopRecording}>Stop recording</Button>
        </div>
      </Callout>
    )
  }

  async function publish(outcome: FeedbackOutcome) {
    if (!selected) return
    setError('')
    setNotice('')
    if (writtenText.trim().length < 3) {
      setError('Add student-visible written feedback before publishing.')
      return
    }
    if (voiceAttached && !voiceEquivalentConfirmed) {
      setError('Confirm that the writing gives the same essential feedback as the voice note.')
      return
    }
    if (outcome === 'correction_requested' && correctionReason.trim().length < 3) {
      setError('Explain what the student needs to correct.')
      return
    }
    setBusy('Publishing feedback to the student…')
    try {
      const id = await saveDraft()
      if (!previewEnabled) {
        await publishFeedback({
          revisionId: id,
          outcome,
          correctionReason: outcome === 'correction_requested' ? correctionReason.trim() : null,
        })
        await queryClient.invalidateQueries({ queryKey: ['feedback-review-queue'] })
      }
      setPublishedAttempts((current) => [...current, selected.submissionAttemptId])
      setNotice(
        outcome === 'review_completed'
          ? 'Feedback published. This assignment is now review completed.'
          : 'Feedback published. The student can now prepare a corrected attempt.',
      )
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The feedback could not be published.')
    } finally {
      setBusy('')
    }
  }

  if (!previewEnabled && queueQuery.isPending) {
    return (
      <section className={styles.state}>
        <p className="eyebrow">Teacher feedback</p>
        <h1>Loading submitted work…</h1>
      </section>
    )
  }
  if (!previewEnabled && queueQuery.isError) {
    return (
      <section className={styles.state}>
        <p className="eyebrow">Teacher feedback</p>
        <h1>The review queue could not be loaded.</h1>
        <Button onClick={() => void queueQuery.refetch()}>Try again</Button>
      </section>
    )
  }

  return (
    <section className={styles.workspace} aria-labelledby="feedback-title">
      <header className={styles.pageHeader}>
        <div>
          <p className="eyebrow">
            Teaching operations · {previewEnabled ? 'Local preview' : 'Live data'}
          </p>
          <h1 id="feedback-title">Feedback review.</h1>
          <p>
            Review submitted work, dictate or write feedback, and deliberately publish it to one
            student.
          </p>
        </div>
        <div className={styles.summary}>
          <strong>{visibleQueue.length}</strong>
          <span>Awaiting review</span>
        </div>
      </header>

      {visibleQueue.length === 0 ? (
        <EmptyState
          title="Review queue complete"
          description="Newly submitted assignments will appear here."
        />
      ) : selected ? (
        <div className={styles.layout}>
          <aside className={styles.queue} aria-label="Feedback review queue">
            {visibleQueue.map((item) => (
              <button
                className={
                  item.submissionAttemptId === selected.submissionAttemptId
                    ? styles.selectedQueueItem
                    : styles.queueItem
                }
                key={item.submissionAttemptId}
                onClick={() => {
                  setSelectedAttemptId(item.submissionAttemptId)
                  setError('')
                  setNotice('')
                }}
                type="button"
              >
                <span>{item.assignmentGroup}</span>
                <strong>{item.displayName}</strong>
                <small>{item.assignmentTitle}</small>
                <small>{submittedLabel(item.submittedAt)}</small>
              </button>
            ))}
          </aside>

          <article className={styles.review}>
            <div className={styles.studentHeader}>
              <div>
                <Badge tone="accent">Submitted</Badge>
                <span>{selected.memberId}</span>
              </div>
              <h2>{selected.displayName}</h2>
              <p>{selected.assignmentTitle}</p>
            </div>

            <section className={styles.submission} aria-labelledby="submission-heading">
              <div>
                <div>
                  <p className="eyebrow">Student work</p>
                  <h3 id="submission-heading">Submitted files</h3>
                </div>
                <Badge tone="neutral">
                  {selected.submissionFileCount}{' '}
                  {selected.submissionFileCount === 1 ? 'file' : 'files'}
                </Badge>
              </div>
              {!previewEnabled && filesQuery.isPending ? (
                <p>Opening private files…</p>
              ) : (
                <div className={styles.fileGrid}>
                  {displayedFiles.map((file) => (
                    <button
                      aria-label={`Preview ${file.name}`}
                      className={styles.filePreview}
                      key={file.id}
                      onClick={() => setExpandedFile(file)}
                      type="button"
                    >
                      <span className={styles.thumbnail}>
                        {file.mimeType.startsWith('image/') ? (
                          <img alt="" src={file.signedUrl} />
                        ) : (
                          <span>PDF</span>
                        )}
                      </span>
                      <span className={styles.fileDetails}>
                        <strong>{file.name}</strong>
                        <small>Click to enlarge on this page</small>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className={styles.composer} aria-labelledby="writing-heading">
              <div className={styles.sectionHeading}>
                <div>
                  <p className="eyebrow">Student-visible</p>
                  <h3 id="writing-heading">Written feedback</h3>
                </div>
                <Badge tone={sourceKind === 'human' ? 'neutral' : 'accent'}>
                  {sourceKind.replaceAll('_', ' ')}
                </Badge>
              </div>
              <textarea
                aria-label="Written feedback"
                maxLength={10000}
                onChange={(event) => {
                  setWrittenText(event.target.value)
                  setSourceKind('human')
                }}
                placeholder="Describe what is working and the clearest next step…"
                rows={7}
                value={writtenText}
              />
              <div className={styles.tools}>
                <Button
                  disabled={Boolean(busy)}
                  onClick={() =>
                    recordingTarget === 'written_dictation'
                      ? stopRecording()
                      : void beginRecording('written_dictation')
                  }
                  variant={recordingTarget === 'written_dictation' ? undefined : 'secondary'}
                >
                  {recordingTarget === 'written_dictation' ? 'Stop dictation' : 'Dictate feedback'}
                </Button>
                <label className={styles.uploadButton}>
                  Upload dictation
                  <input
                    accept="audio/webm,audio/mpeg,audio/mp4"
                    onChange={(event) => void handleAudioFile(event, 'written_dictation')}
                    type="file"
                  />
                </label>
                <Button
                  disabled={Boolean(busy)}
                  onClick={() => void proofread()}
                  variant="secondary"
                >
                  Proofread with AI
                </Button>
              </div>
              {recordingStatus('written_dictation', 'written feedback')}
            </section>

            {proofreadSuggestion ? (
              <section className={styles.comparison} aria-labelledby="proofread-heading">
                <div className={styles.sectionHeading}>
                  <div>
                    <p className="eyebrow">Human review required</p>
                    <h3 id="proofread-heading">Proofreading suggestion</h3>
                  </div>
                  <Badge tone="accent">Not applied</Badge>
                </div>
                <div className={styles.compareGrid}>
                  <div>
                    <h4>Original</h4>
                    <p>{proofreadOriginal}</p>
                  </div>
                  <div>
                    <label htmlFor="proofread-suggestion">Suggestion</label>
                    <textarea
                      id="proofread-suggestion"
                      onChange={(event) => setProofreadSuggestion(event.target.value)}
                      rows={5}
                      value={proofreadSuggestion}
                    />
                  </div>
                </div>
                <div className={styles.tools}>
                  <Button
                    onClick={() => {
                      setWrittenText(proofreadSuggestion)
                      setSourceKind('ai_proofread')
                      setProofreadOriginal('')
                      setProofreadSuggestion('')
                      setNotice(
                        'Proofreading suggestion accepted. You can still edit it before publishing.',
                      )
                    }}
                  >
                    Accept suggestion
                  </Button>
                  <Button
                    onClick={() => {
                      setProofreadOriginal('')
                      setProofreadSuggestion('')
                      setNotice('Suggestion rejected. Your original writing is unchanged.')
                    }}
                    variant="ghost"
                  >
                    Reject suggestion
                  </Button>
                </div>
              </section>
            ) : null}

            <section className={styles.voice} aria-labelledby="voice-heading">
              <div>
                <p className="eyebrow">Optional playable audio</p>
                <h3 id="voice-heading">Voice note</h3>
                <p>Keep this in addition to the written version, never instead of it.</p>
              </div>
              <div className={styles.tools}>
                <Button
                  disabled={Boolean(busy)}
                  onClick={() =>
                    recordingTarget === 'voice_note'
                      ? stopRecording()
                      : void beginRecording('voice_note')
                  }
                  variant={recordingTarget === 'voice_note' ? undefined : 'secondary'}
                >
                  {recordingTarget === 'voice_note' ? 'Stop voice note' : 'Record voice note'}
                </Button>
                <label className={styles.uploadButton}>
                  Upload voice note
                  <input
                    accept="audio/webm,audio/mpeg,audio/mp4"
                    onChange={(event) => void handleAudioFile(event, 'voice_note')}
                    type="file"
                  />
                </label>
              </div>
              {recordingStatus('voice_note', 'a voice note')}
              {voiceAttached ? (
                <>
                  <audio aria-label="Voice feedback preview" controls />
                  <label className={styles.confirm}>
                    <input
                      checked={voiceEquivalentConfirmed}
                      onChange={(event) => setVoiceEquivalentConfirmed(event.target.checked)}
                      type="checkbox"
                    />
                    The writing above gives the same essential feedback as this voice note.
                  </label>
                </>
              ) : null}
            </section>

            <section className={styles.publish} aria-labelledby="publish-heading">
              <div>
                <p className="eyebrow">Deliberate publication</p>
                <h3 id="publish-heading">Choose the student’s next step</h3>
              </div>
              <label htmlFor="correction-reason">
                Correction request (required only when requesting another attempt)
              </label>
              <textarea
                id="correction-reason"
                maxLength={500}
                onChange={(event) => {
                  setCorrectionReason(event.target.value)
                  setCorrectionProofreadOriginal('')
                  setCorrectionProofreadSuggestion('')
                }}
                rows={3}
                value={correctionReason}
              />
              <div className={styles.tools}>
                <Button
                  disabled={Boolean(busy)}
                  onClick={() =>
                    recordingTarget === 'correction_dictation'
                      ? stopRecording()
                      : void beginRecording('correction_dictation')
                  }
                  variant={recordingTarget === 'correction_dictation' ? undefined : 'secondary'}
                >
                  {recordingTarget === 'correction_dictation'
                    ? 'Stop correction dictation'
                    : 'Dictate correction'}
                </Button>
                <Button disabled={Boolean(busy)} onClick={proofreadCorrection} variant="secondary">
                  Proofread correction with AI
                </Button>
              </div>
              {recordingStatus('correction_dictation', 'the correction request')}
              {correctionProofreadSuggestion ? (
                <div className={styles.correctionSuggestion}>
                  <div className={styles.sectionHeading}>
                    <div>
                      <p className="eyebrow">Human review required</p>
                      <h4>Correction wording suggestion</h4>
                    </div>
                    <Badge tone="accent">Not applied</Badge>
                  </div>
                  <div className={styles.compareGrid}>
                    <div>
                      <h4>Original</h4>
                      <p>{correctionProofreadOriginal}</p>
                    </div>
                    <div>
                      <label htmlFor="correction-proofread-suggestion">Suggestion</label>
                      <textarea
                        id="correction-proofread-suggestion"
                        onChange={(event) => setCorrectionProofreadSuggestion(event.target.value)}
                        rows={4}
                        value={correctionProofreadSuggestion}
                      />
                    </div>
                  </div>
                  <div className={styles.tools}>
                    <Button
                      onClick={() => {
                        setCorrectionReason(correctionProofreadSuggestion)
                        setCorrectionProofreadOriginal('')
                        setCorrectionProofreadSuggestion('')
                        setNotice(
                          'Correction wording accepted. You can still edit it before publishing.',
                        )
                      }}
                    >
                      Accept correction suggestion
                    </Button>
                    <Button
                      onClick={() => {
                        setCorrectionProofreadOriginal('')
                        setCorrectionProofreadSuggestion('')
                        setNotice('Suggestion rejected. Your correction request is unchanged.')
                      }}
                      variant="ghost"
                    >
                      Reject correction suggestion
                    </Button>
                  </div>
                </div>
              ) : null}
              <div className={styles.publishActions}>
                <Button disabled={Boolean(busy)} onClick={() => void publish('review_completed')}>
                  Publish & complete review
                </Button>
                <Button
                  disabled={Boolean(busy)}
                  onClick={() => void publish('correction_requested')}
                  variant="secondary"
                >
                  Publish & request correction
                </Button>
                <Button disabled={Boolean(busy)} onClick={() => void handleSave()} variant="ghost">
                  Save private draft
                </Button>
              </div>
            </section>

            {busy ? (
              <p className={styles.busy} aria-live="polite">
                {busy}
              </p>
            ) : null}
            {error ? (
              <Callout tone="warning" icon="warning">
                {error}
              </Callout>
            ) : null}
            {notice ? (
              <Callout tone="success" icon="success">
                {notice}
              </Callout>
            ) : null}
          </article>
        </div>
      ) : null}
      {expandedFile ? (
        <div
          className={styles.viewerBackdrop}
          onClick={(event) => {
            if (event.currentTarget === event.target) setExpandedFile(null)
          }}
          role="presentation"
        >
          <section
            aria-labelledby="submission-viewer-title"
            aria-modal="true"
            className={styles.viewer}
            role="dialog"
          >
            <header>
              <div>
                <p className="eyebrow">Submitted file</p>
                <h2 id="submission-viewer-title">{expandedFile.name}</h2>
              </div>
              <Button onClick={() => setExpandedFile(null)} variant="ghost">
                Close preview
              </Button>
            </header>
            <div className={styles.viewerCanvas}>
              {expandedFile.mimeType.startsWith('image/') ? (
                <img
                  alt={`Expanded submission: ${expandedFile.name}`}
                  src={expandedFile.signedUrl}
                />
              ) : (
                <iframe
                  src={expandedFile.signedUrl}
                  title={`Expanded submission: ${expandedFile.name}`}
                />
              )}
            </div>
            <a href={expandedFile.signedUrl} rel="noreferrer" target="_blank">
              Open original in a new tab
            </a>
          </section>
        </div>
      ) : null}
    </section>
  )
}
