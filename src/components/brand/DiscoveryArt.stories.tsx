import type { Meta, StoryObj } from '@storybook/react-vite'
import { DiscoveryArt } from './DiscoveryArt'

const meta = {
  title: 'Foundations/Discovery/Illustrations',
  component: DiscoveryArt,
  parameters: { layout: 'centered' },
  args: { kind: 'seeing' },
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DiscoveryArt>
export default meta
type Story = StoryObj<typeof meta>
export const Seeing: Story = {}
export const Making: Story = { args: { kind: 'making' } }
export const Space: Story = { args: { kind: 'space' } }
export const Typography: Story = { args: { kind: 'type' } }
export const Growth: Story = { args: { kind: 'growth' } }
export const Dark: Story = {
  decorators: [
    (Story) => (
      <div data-theme="dark" style={{ padding: 24, background: 'var(--bg-page)' }}>
        <Story />
      </div>
    ),
  ],
}
