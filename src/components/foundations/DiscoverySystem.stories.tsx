import type { Meta, StoryObj } from '@storybook/react-vite'
import { Brand } from '../brand/Brand'
import { DiscoveryArt } from '../brand/DiscoveryArt'
import { Button, Badge, Card, Callout, Input, EmptyState } from '..'

function DiscoverySystem({ dark = false }: { dark?: boolean }) {
  return (
    <div
      data-theme={dark ? 'dark' : 'light'}
      style={{
        color: 'var(--text-body)',
        background: 'var(--bg-page)',
        padding: 'clamp(24px, 5vw, 64px)',
        maxWidth: 1200,
        margin: 'auto',
      }}
    >
      <Brand />
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 32,
          paddingBlock: 32,
        }}
      >
        <div style={{ flex: '1 1 280px' }}>
          <p className="eyebrow">DEXAM Discovery · 1.0</p>
          <h1>
            Less reading.
            <br />
            <em style={{ color: 'var(--accent-primary)' }}>More discovering.</em>
          </h1>
          <p className="muted" style={{ marginTop: 16 }}>
            Paper, purposeful color, and a little curiosity.
          </p>
        </div>
        <div style={{ width: 300, maxWidth: '100%' }}>
          <DiscoveryArt kind="making" />
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 32 }}>
        {[
          '--brand-paper',
          '--brand-ink',
          '--brand-green',
          '--brand-orange',
          '--brand-yellow',
          '--brand-lime',
        ].map((color) => (
          <div key={color} style={{ minWidth: 120, flex: 1 }}>
            <div
              style={{
                height: 56,
                background: `var(${color})`,
                borderRadius: 6,
                border: '1px solid var(--border-default)',
              }}
            />
            <p style={{ fontSize: 12 }}>{color.replace('--brand-', '')}</p>
          </div>
        ))}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
          gap: 24,
        }}
      >
        <Card>
          <p className="eyebrow">Action & feedback</p>
          <h2>Make a small start.</h2>
          <p className="muted" style={{ marginBlock: 16 }}>
            One clear next step. Enough room to think.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <Button>Continue →</Button>
            <Button variant="secondary">Explore</Button>
            <Button disabled>Loading…</Button>
          </div>
          <div style={{ marginTop: 20 }}>
            <Badge tone="success" pill>
              Completed
            </Badge>
          </div>
        </Card>
        <Card>
          <h2>Room for the details.</h2>
          <div style={{ display: 'grid', gap: 16, marginTop: 16 }}>
            <Input label="Your name" placeholder="e.g. Aarohi" />
            <Input label="Email" error="Enter a complete email address." value="aarohi@" readOnly />
            <Callout tone="warning">Your work is saved. Check your connection to continue.</Callout>
          </div>
        </Card>
        <EmptyState
          title="Your next idea starts here."
          description="A quiet state with a helpful next step."
          action={<Button variant="secondary">Explore practice</Button>}
        />
      </div>
    </div>
  )
}
const meta = {
  title: 'Foundations/Discovery/Design system',
  component: DiscoverySystem,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof DiscoverySystem>
export default meta
type Story = StoryObj<typeof meta>
export const Light: Story = {}
export const Dark: Story = { args: { dark: true } }
