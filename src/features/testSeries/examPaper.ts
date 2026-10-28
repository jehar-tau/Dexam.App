/**
 * F042 exam-window paper shape, plus the fictional practice paper used until the
 * question bank (F038) serves real papers. The fixture carries no answer keys:
 * keys stay server-side once scoring (F044) exists.
 */

export type ExamQuestionKind = 'nat' | 'msq' | 'mcq'

export type ExamFigureId = 'cube-net' | 'tile-grid' | 'shape-sequence'

export type ExamOption = { id: string; text: string }

export type ExamQuestion = {
  id: string
  kind: ExamQuestionKind
  prompt: string
  figure?: ExamFigureId
  options?: ExamOption[]
}

export type ExamSection = {
  id: string
  name: string
  kindLabel: string
  marking: { correct: number; wrong: number; note?: string }
  questions: ExamQuestion[]
}

export type ExamPaper = {
  title: string
  durationMinutes: number
  sections: ExamSection[]
}

const options = (...texts: string[]): ExamOption[] =>
  texts.map((text, index) => ({ id: String.fromCharCode(65 + index), text }))

export const practicePaper: ExamPaper = {
  title: 'Dexam practice paper',
  durationMinutes: 20,
  sections: [
    {
      id: 'nat',
      name: 'NAT',
      kindLabel: 'Numerical answer',
      marking: { correct: 4, wrong: 0 },
      questions: [
        {
          id: 'nat-1',
          kind: 'nat',
          prompt:
            'A square sheet is divided into a 4 × 4 grid of equal squares. How many of the small squares touch the outer edge of the sheet?',
        },
        {
          id: 'nat-2',
          kind: 'nat',
          prompt:
            'The figure shows the net of a cube. When it is folded, how many faces share an edge with the shaded face?',
          figure: 'cube-net',
        },
        {
          id: 'nat-3',
          kind: 'nat',
          prompt:
            'A poster is 60 cm wide. It is reduced so that its width becomes 45 cm. By what percentage was it reduced?',
        },
        {
          id: 'nat-4',
          kind: 'nat',
          prompt:
            'How many rectangles of any size (squares included) can be found in a 2 × 3 grid of equal squares?',
        },
      ],
    },
    {
      id: 'msq',
      name: 'MSQ',
      kindLabel: 'Multiple select',
      marking: {
        correct: 4,
        wrong: -1,
        note: 'Part marks for each correct option chosen when no wrong option is chosen.',
      },
      questions: [
        {
          id: 'msq-1',
          kind: 'msq',
          prompt: 'Select every property that makes a public wayfinding sign easier to use.',
          options: options(
            'High contrast between text and background',
            'A consistent set of symbols',
            'Small decorative lettering',
            'Placement within the expected line of sight',
          ),
        },
        {
          id: 'msq-2',
          kind: 'msq',
          prompt: 'In the tile grid shown, which statements are true?',
          figure: 'tile-grid',
          options: options(
            'Exactly half of the tiles are shaded',
            'The pattern has a vertical line of symmetry',
            'Every row has the same number of shaded tiles',
            'No two shaded tiles share an edge',
          ),
        },
        {
          id: 'msq-3',
          kind: 'msq',
          prompt: 'Which of these materials are usually recyclable as part of household waste?',
          options: options(
            'Aluminium cans',
            'Glass bottles',
            'Used tissue paper',
            'Clean cardboard',
          ),
        },
        {
          id: 'msq-4',
          kind: 'msq',
          prompt: 'Which of these are primary colours in the additive (light) colour model?',
          options: options('Red', 'Yellow', 'Green', 'Blue'),
        },
      ],
    },
    {
      id: 'mcq',
      name: 'MCQ',
      kindLabel: 'Multiple choice',
      marking: { correct: 3, wrong: -1 },
      questions: [
        {
          id: 'mcq-1',
          kind: 'mcq',
          prompt:
            'Which drawing shows the height, width and depth of an object together in one view?',
          options: options('Plan', 'Elevation', 'Isometric view', 'Section'),
        },
        {
          id: 'mcq-2',
          kind: 'mcq',
          prompt: 'Which shape comes next in the sequence shown?',
          figure: 'shape-sequence',
          options: options('Triangle', 'Square', 'Pentagon', 'Hexagon'),
        },
        {
          id: 'mcq-3',
          kind: 'mcq',
          prompt: 'A chair designed to stack with others mainly saves which of these?',
          options: options('Weight', 'Floor space when stored', 'Material cost', 'Assembly time'),
        },
        {
          id: 'mcq-4',
          kind: 'mcq',
          prompt: 'Which word is closest in meaning to "ergonomic"?',
          options: options('Decorative', 'Comfortable to use', 'Inexpensive', 'Lightweight'),
        },
        {
          id: 'mcq-5',
          kind: 'mcq',
          prompt:
            'A clock shows 3:00. What is the smaller angle between its hour and minute hands, in degrees?',
          options: options('45', '60', '90', '120'),
        },
        {
          id: 'mcq-6',
          kind: 'mcq',
          prompt: 'Which of these is a warm colour?',
          options: options('Teal', 'Violet', 'Orange', 'Navy'),
        },
      ],
    },
  ],
}

export function paperQuestions(paper: ExamPaper): ExamQuestion[] {
  return paper.sections.flatMap((section) => section.questions)
}

export function sectionOf(paper: ExamPaper, questionId: string): ExamSection | undefined {
  return paper.sections.find((section) => section.questions.some((q) => q.id === questionId))
}
