import type { Meta, StoryObj } from '@storybook/react-vite'

import { Callout } from './Callout'

const meta = {
  title: 'Components/Surfaces/Callout',
  component: Callout,
  args: { children: 'The student creates their own password.' },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 520 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Callout>

export default meta
type Story = StoryObj<typeof meta>

export const Accent: Story = {}
export const Neutral: Story = { args: { tone: 'neutral' } }
export const Success: Story = { args: { icon: 'success', tone: 'success' } }
export const Warning: Story = { args: { icon: 'warning', tone: 'warning' } }
