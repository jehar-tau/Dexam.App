import type { Meta, StoryObj } from '@storybook/react-vite'

import { Input } from './Input'

const meta = {
  title: 'Components/Forms/Input',
  component: Input,
  args: {
    label: 'Employee email',
    placeholder: 'name@dexam.in',
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 420 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Input>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const WithHint: Story = { args: { hint: 'Use your individually assigned work email.' } }
export const Error: Story = { args: { error: 'Enter a valid employee email.' } }
export const Disabled: Story = { args: { disabled: true, value: 'operator@dexam.in' } }
