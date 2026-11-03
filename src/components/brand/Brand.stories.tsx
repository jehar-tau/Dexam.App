import type { Meta, StoryObj } from '@storybook/react-vite'
import { Brand } from './Brand'
const meta = {
  title: 'Foundations/Discovery/Brand',
  component: Brand,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Brand>
export default meta
type Story = StoryObj<typeof meta>
export const Academy: Story = {}
export const StudentPortal: Story = { args: { subtitle: 'Student portal' } }
export const TestSeries: Story = { args: { subtitle: 'Test series' } }
