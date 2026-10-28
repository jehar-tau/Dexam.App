import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../../features/auth/AuthContext'
import { getSupabaseClient } from '../../features/auth/supabaseClient'
import {
  fetchPracticeTopics,
  startPractice,
  type PracticeOptions,
  type PracticeTopic,
} from '../../features/testSeries/bankPaper'
import { previewSearch } from '../../features/testSeries/previewSearch'
import styles from './TestsPracticePage.module.css'

const examChoices: { value: PracticeOptions['exam']; label: string }[] = [
  { value: null, label: 'All exams' },
  { value: 'uceed', label: 'UCEED' },
  { value: 'ceed', label: 'CEED' },
  { value: 'nid', label: 'NID DAT' },
  { value: 'nift', label: 'NIFT' },
]

const sizes: PracticeOptions['size'][] = [10, 25, 50]

// Fictional topics for the preview; real topics come from the reviewed bank.
const previewTopics: PracticeTopic[] = [
  { slug: 'numerical-reasoning', name: 'Numerical Reasoning', ready: 123, unseen: 101 },
  { slug: 'spatial-reasoning', name: 'Spatial Reasoning', ready: 42, unseen: 42 },
  { slug: 'analytical-reasoning', name: 'Analytical Reasoning', ready: 85, unseen: 77 },
  { slug: 'design-awareness', name: 'Design Awareness', ready: 12, unseen: 12 },
  { slug: 'materials', name: 'Materials', ready: 26, unseen: 20 },
]

export function TestsPracticePage() {
  const location = useLocation()
  const navigate = useNavigate()
  const search = previewSearch(location.search)
  const preview = search !== ''
  const { session } = useAuth()
  const client = getSupabaseClient()

  const [exam, setExam] = useState<PracticeOptions['exam']>(null)
  const [topic, setTopic] = useState(() => new URLSearchParams(location.search).get('topic') ?? '')
  const [size, setSize] = useState<PracticeOptions['size']>(10)
  const [timed, setTimed] = useState(true)

  const topics = useQuery({
    queryKey: ['practice-topics', session?.user.id, exam],
    queryFn: () => fetchPracticeTopics(client!, exam),
    enabled: !preview && Boolean(client && session),
    staleTime: 30_000,
  })
  const list = preview ? previewTopics : (topics.data ?? [])
  const chosen = list.find((item) => item.slug === topic)

  const start = useMutation({
    mutationFn: () => startPractice(client!, { topic, size, timed, exam }),
    onSuccess: (attemptId) => {
      if (attemptId) void navigate(`/tests/practice/run/${attemptId}`)
    },
  })

  return (
    <div className={styles.page}>
      <div>
        <h1 className={styles.title}>Topic practice</h1>
        <p className={styles.lede}>
          Build a short set on one topic. Questions you have not seen come first, and every answer
          is explained in the review afterwards.
        </p>
      </div>

      <section className={styles.panel} aria-labelledby="practice-exam">
        <h2 id="practice-exam" className={styles.step}>
          <span className={styles.stepNumber}>1</span> Exam
        </h2>
        <div className={styles.segmented} role="group" aria-label="Exam">
          {examChoices.map((choice) => (
            <button
              key={choice.label}
              type="button"
              className={`${styles.segment} ${exam === choice.value ? styles.segmentActive : ''}`}
              aria-pressed={exam === choice.value}
              onClick={() => setExam(choice.value)}
            >
              {choice.label}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.panel} aria-labelledby="practice-topic">
        <h2 id="practice-topic" className={styles.step}>
          <span className={styles.stepNumber}>2</span> Topic
        </h2>
        {topics.isPending && !preview && client && session ? (
          <p className={styles.note}>Loading topics…</p>
        ) : topics.isError ? (
          <p className={styles.note}>{topics.error.message}</p>
        ) : list.length === 0 ? (
          <p className={styles.note}>
            No reviewed questions for this exam yet. Try another exam or all exams.
          </p>
        ) : (
          <div className={styles.topics} role="radiogroup" aria-label="Topic">
            {list.map((item) => (
              <label
                key={item.slug}
                className={`${styles.topic} ${topic === item.slug ? styles.topicActive : ''}`}
              >
                <input
                  type="radio"
                  name="practice-topic"
                  value={item.slug}
                  checked={topic === item.slug}
                  onChange={() => setTopic(item.slug)}
                />
                <span className={styles.topicName}>{item.name}</span>
                <span className={styles.topicMeta}>
                  {item.ready} questions · {item.unseen} new to you
                </span>
              </label>
            ))}
          </div>
        )}
      </section>

      <section className={styles.panel} aria-labelledby="practice-set">
        <h2 id="practice-set" className={styles.step}>
          <span className={styles.stepNumber}>3</span> Set
        </h2>
        <div className={styles.row}>
          <div className={styles.segmented} role="group" aria-label="Questions">
            {sizes.map((value) => (
              <button
                key={value}
                type="button"
                className={`${styles.segment} ${size === value ? styles.segmentActive : ''}`}
                aria-pressed={size === value}
                onClick={() => setSize(value)}
              >
                {value} questions
              </button>
            ))}
          </div>
          <div className={styles.segmented} role="group" aria-label="Timing">
            {[true, false].map((value) => (
              <button
                key={String(value)}
                type="button"
                className={`${styles.segment} ${timed === value ? styles.segmentActive : ''}`}
                aria-pressed={timed === value}
                onClick={() => setTimed(value)}
              >
                {value ? 'Timed (90 s a question)' : 'Untimed'}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primary}
          disabled={preview || !chosen || start.isPending}
          onClick={() => start.mutate()}
        >
          {start.isPending ? 'Building your set…' : 'Start practice'}
        </button>
        <p className={styles.note} role="status">
          {preview
            ? 'Preview shows sample topics. Sign in as a student to start a practice set.'
            : start.isError
              ? start.error.message
              : start.data === null
                ? 'No reviewed questions on this topic yet.'
                : chosen
                  ? `${Math.min(size, chosen.ready)} questions on ${chosen.name}${chosen.ready < size ? ' (all that are ready)' : ''}.`
                  : 'Choose a topic to start.'}
        </p>
      </div>
    </div>
  )
}
