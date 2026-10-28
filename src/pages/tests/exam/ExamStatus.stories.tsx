import type { Meta, StoryObj } from '@storybook/react-vite'

import { StatusLegend } from './ExamStatus'

const meta = {
  title: 'Test series/Exam/Status legend',
  component: StatusLegend,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof StatusLegend>

export default meta
type Story = StoryObj<typeof meta>

export const Instructions: Story = {}
export const WithCounts: Story = {
  args: {
    counts: {
      total: 14,
      'not-visited': 8,
      'not-answered': 2,
      answered: 2,
      review: 1,
      'answered-review': 1,
    },
  },
}
