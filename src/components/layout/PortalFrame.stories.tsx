import type { Meta, StoryObj } from '@storybook/react-vite'
import { PortalFrame } from './PortalFrame'
const meta = {
  title: 'Patterns/Layout/PortalFrame',
  component: PortalFrame,
  args: {
    portal: 'student',
    navigation: (
      <>
        <a href="#main-content">Workspace home</a>
        <a href="#main-content">Notifications</a>
      </>
    ),
    children: (
      <section>
        <h1>Your workspace</h1>
        <p>Existing authorized tools appear here.</p>
      </section>
    ),
  },
} satisfies Meta<typeof PortalFrame>
export default meta
type Story = StoryObj<typeof meta>
export const Student: Story = {}
export const Teacher: Story = { args: { portal: 'teacher' } }
export const Staff: Story = { args: { portal: 'staff' } }
export const Admin: Story = { args: { portal: 'admin' } }
export const Public: Story = { args: { portal: null } }
export const Mobile: Story = {
  args: { portal: 'staff' },
  globals: { viewport: { value: 'mobile1', isRotated: false } },
}
