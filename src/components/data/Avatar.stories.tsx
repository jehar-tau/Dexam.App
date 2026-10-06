import type { Meta, StoryObj } from '@storybook/react-vite'

import { Avatar } from './Avatar'

const meta = {
  title: 'Components/Data/Avatar',
  component: Avatar,
  args: { name: 'Aarohi Deshmukh' },
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Avatar>

export default meta
type Story = StoryObj<typeof meta>

export const Medium: Story = {}
export const Small: Story = { args: { size: 'sm' } }
export const Large: Story = { args: { size: 'lg' } }
