import {
  createExamSession,
  questionState,
  setAnswer,
  toggleReview,
  visitQuestion,
} from './examSession'

describe('exam session', () => {
  it('tracks navigation, answers, and review states independently', () => {
    let session = createExamSession()
    session = visitQuestion(session, 'msq-1')
    expect(questionState(session, 'msq-1')).toBe('visited')
    session = setAnswer(session, 'msq-1', ['A', 'B'])
    expect(questionState(session, 'msq-1')).toBe('answered')
    session = toggleReview(session, 'msq-1')
    expect(questionState(session, 'msq-1')).toBe('answered-review')
  })

  it('removes blank answers rather than treating them as attempted', () => {
    let session = setAnswer(createExamSession(), 'nat-1', '12')
    session = setAnswer(session, 'nat-1', '')
    expect(questionState(session, 'nat-1')).toBe('visited')
  })
})
