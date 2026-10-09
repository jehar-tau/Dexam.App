import type { Meta, StoryObj } from '@storybook/react-vite'

import { Button } from '../core'
import { EmptyState } from './EmptyState'

const meta = {
  title: 'Components/Feedback/EmptyState',
  component: EmptyState,
  args: {
    title: 'No enrolments are ready',
    description: 'Approved enrolments will appear here when they are ready for activation.',
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 700 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EmptyState>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const WithAction: Story = {
  args: { action: <Button variant="secondary">Refresh queue</Button> },
}
