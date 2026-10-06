import type { Meta, StoryObj } from '@storybook/react-vite'

import { Card } from './Card'

const meta = {
  title: 'Components/Surfaces/Card',
  component: Card,
  args: { children: 'A quiet bordered surface for grouped content.' },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 420 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Card>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Interactive: Story = { args: { interactive: true, onClick: () => undefined } }
export const Selected: Story = { args: { selected: true } }
