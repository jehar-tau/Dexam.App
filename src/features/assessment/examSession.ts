export type QuestionKind = 'mcq' | 'msq' | 'nat' | 'drawing'

export type ExamQuestion = {
  id: string
  section: 'Part A · NAT' | 'Part A · MSQ' | 'Part A · MCQ' | 'Part B'
  kind: QuestionKind
  prompt: string
  options?: string[]
  marks: number
}

export type Answer = string | string[]

export type ExamSession = {
  activeQuestionId: string
  answers: Record<string, Answer>
  visited: string[]
  markedForReview: string[]
  submitted: boolean
}

export const previewQuestions: ExamQuestion[] = [
  {
    id: 'nat-1',
    section: 'Part A · NAT',
    kind: 'nat',
    prompt:
      'A square sheet is divided into sixteen equal squares. How many small squares touch the outer boundary?',
    marks: 4,
  },
  {
    id: 'msq-1',
    section: 'Part A · MSQ',
    kind: 'msq',
    prompt: 'Select every property that can improve the usability of a public wayfinding sign.',
    options: [
      'High contrast between text and background',
      'A consistent symbol system',
      'Small decorative lettering',
      'Placement within the expected sight line',
    ],
    marks: 4,
  },
  {
    id: 'mcq-1',
    section: 'Part A · MCQ',
    kind: 'mcq',
    prompt:
      'Which view most directly communicates the height, width, and depth of an object together?',
    options: ['Plan', 'Elevation', 'Isometric view', 'Section'],
    marks: 3,
  },
  {
    id: 'drawing-1',
    section: 'Part B',
    kind: 'drawing',
    prompt:
      'Draw a compact study corner for a student living in a shared room. Show storage, lighting, and how the desk is used.',
    marks: 50,
  },
]

export function createExamSession(questions = previewQuestions): ExamSession {
  const first = questions[0]
  if (!first) throw new Error('An exam requires at least one question.')
  return {
    activeQuestionId: first.id,
    answers: {},
    visited: [first.id],
    markedForReview: [],
    submitted: false,
  }
}

export function questionState(session: ExamSession, questionId: string) {
  const answered = Object.prototype.hasOwnProperty.call(session.answers, questionId)
  const review = session.markedForReview.includes(questionId)
  if (answered && review) return 'answered-review'
  if (review) return 'review'
  if (answered) return 'answered'
  if (session.visited.includes(questionId)) return 'visited'
  return 'unvisited'
}

export function visitQuestion(session: ExamSession, questionId: string): ExamSession {
  return {
    ...session,
    activeQuestionId: questionId,
    visited: session.visited.includes(questionId)
      ? session.visited
      : [...session.visited, questionId],
  }
}

export function setAnswer(session: ExamSession, questionId: string, answer: Answer): ExamSession {
  const empty = Array.isArray(answer) ? answer.length === 0 : answer.trim() === ''
  const answers = { ...session.answers }
  if (empty) delete answers[questionId]
  else answers[questionId] = answer
  return { ...session, answers }
}

export function toggleReview(session: ExamSession, questionId: string): ExamSession {
  const selected = session.markedForReview.includes(questionId)
  return {
    ...session,
    markedForReview: selected
      ? session.markedForReview.filter((id) => id !== questionId)
      : [...session.markedForReview, questionId],
  }
}
