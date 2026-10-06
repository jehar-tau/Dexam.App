import type { Meta, StoryObj } from '@storybook/react-vite'

import { DataRow } from './DataRow'

const meta = {
  title: 'Components/Data/DataRow',
  component: DataRow,
  args: {
    meta: 'DXM-2K3M9Q2RW5TY',
    primary: 'Aarohi Deshmukh',
    secondary: 'Design Entrance Foundation',
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 620 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DataRow>

export default meta
type Story = StoryObj<typeof meta>

export const Static: Story = {}
export const Interactive: Story = { args: { onClick: () => undefined } }
