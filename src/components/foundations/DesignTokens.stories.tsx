import type { Meta, StoryObj } from '@storybook/react-vite'

import { DesignTokens } from './DesignTokens'

const meta: Meta<typeof DesignTokens> = {
  title: 'Foundations/Design Tokens',
  component: DesignTokens,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Live DEXAM Discovery values read from the active theme. `pnpm design:tokens` checks the versioned contract and light/dark text contrast. See `docs/design/DISCOVERY.md` and D-064.',
      },
    },
  },
}

export default meta

type Story = StoryObj<typeof DesignTokens>

export const Tokens: Story = {}
