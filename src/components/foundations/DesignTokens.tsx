interface ColorToken {
  name: string
  label: string
}

interface ColorGroup {
  title: string
  tokens: ColorToken[]
}

const COLOR_GROUPS: ColorGroup[] = [
  {
    title: 'Surfaces',
    tokens: [
      { name: '--bg-page', label: 'bg-page' },
      { name: '--bg-page-warm', label: 'bg-page-warm' },
      { name: '--surface-card', label: 'surface-card' },
      { name: '--surface-muted', label: 'surface-muted' },
      { name: '--surface-hover', label: 'surface-hover' },
      { name: '--surface-selected', label: 'surface-selected' },
    ],
  },
  {
    title: 'Borders',
    tokens: [
      { name: '--border-default', label: 'border-default' },
      { name: '--border-strong', label: 'border-strong' },
      { name: '--border-selected', label: 'border-selected' },
    ],
  },
  {
    title: 'Text',
    tokens: [
      { name: '--text-body', label: 'text-body' },
      { name: '--text-secondary', label: 'text-secondary' },
      { name: '--text-muted', label: 'text-muted' },
      { name: '--text-link', label: 'text-link' },
    ],
  },
  {
    title: 'Accent',
    tokens: [
      { name: '--accent-primary', label: 'accent-primary' },
      { name: '--accent-primary-hover', label: 'accent-primary-hover' },
      { name: '--accent-primary-active', label: 'accent-primary-active' },
      { name: '--accent-soft', label: 'accent-soft' },
      { name: '--accent-extra-soft', label: 'accent-extra-soft' },
    ],
  },
  {
    title: 'Semantic',
    tokens: [
      { name: '--color-success', label: 'success' },
      { name: '--color-warning', label: 'warning' },
      { name: '--color-danger', label: 'danger' },
      { name: '--color-info', label: 'info' },
    ],
  },
]

const FONT_FAMILIES = [
  { name: '--font-sans', label: 'Sans — UI & body' },
  { name: '--font-serif', label: 'Serif — editorial headings' },
  { name: '--font-mono', label: 'Mono — metadata & code' },
]

const TYPE_SCALE = [
  '--fs-display',
  '--fs-h1',
  '--fs-h2',
  '--fs-h3',
  '--fs-body',
  '--fs-body-sm',
  '--fs-caption',
]

const SPACE_SCALE = [
  '--space-1',
  '--space-2',
  '--space-3',
  '--space-4',
  '--space-5',
  '--space-6',
  '--space-8',
  '--space-12',
  '--space-16',
  '--space-24',
]

const RADIUS_SCALE = ['--radius-sm', '--radius-md', '--radius-lg', '--radius-xl', '--radius-full']

const SHADOW_SCALE = [
  '--shadow-xs',
  '--shadow-sm',
  '--shadow-md',
  '--shadow-lg',
  '--shadow-focus-ring',
]

function readToken(name: string): string {
  if (typeof window === 'undefined') {
    return ''
  }
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

/**
 * Renders live values read from the DOM, so this cannot drift from the
 * vendored tokens in src/styles/design-system/ — see
 * docs/decisions/ADR-011-shared-design-system-repository.md.
 */
export function DesignTokens() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
      <section>
        <SectionTitle>Color</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {COLOR_GROUPS.map((group) => (
            <div key={group.title}>
              <h3
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  marginBottom: '0.5rem',
                }}
              >
                {group.title}
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                {group.tokens.map((token) => (
                  <ColorSwatch key={token.name} name={token.name} label={token.label} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>Typography</SectionTitle>
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}
        >
          {FONT_FAMILIES.map(({ name, label }) => (
            <div key={name} style={{ fontFamily: `var(${name})` }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{label}</span>
              <div style={{ fontSize: '1.25rem' }}>The quick brown fox jumps over the lazy dog</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {TYPE_SCALE.map((name) => (
            <div key={name} style={{ display: 'flex', alignItems: 'baseline', gap: '1rem' }}>
              <code style={{ width: '7rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {name}
              </code>
              <span style={{ fontSize: `var(${name})`, fontFamily: 'var(--font-sans)' }}>
                Dexam
              </span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>Spacing</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {SPACE_SCALE.map((name) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <code style={{ width: '6rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {name}
              </code>
              <div
                style={{
                  height: '0.9rem',
                  width: `var(${name})`,
                  background: 'var(--accent-primary)',
                }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {readToken(name)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>Radius</SectionTitle>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
          {RADIUS_SCALE.map((name) => (
            <div
              key={name}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                fontSize: '0.75rem',
              }}
            >
              <div
                style={{
                  width: '4rem',
                  height: '4rem',
                  background: 'var(--surface-muted)',
                  border: '1px solid var(--border-default)',
                  borderRadius: `var(${name})`,
                }}
              />
              <code>{name}</code>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>Shadow</SectionTitle>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
          {SHADOW_SCALE.map((name) => (
            <div
              key={name}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                fontSize: '0.75rem',
              }}
            >
              <div
                style={{
                  width: '4rem',
                  height: '4rem',
                  background: 'var(--surface-card)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: `var(${name})`,
                }}
              />
              <code>{name}</code>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function SectionTitle({ children }: { children: string }) {
  return <h2 style={{ fontSize: '1rem', marginBottom: '1rem' }}>{children}</h2>
}

function ColorSwatch({ name, label }: { name: string; label: string }) {
  const value = readToken(name)
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        minWidth: '9rem',
        fontSize: '0.8rem',
      }}
    >
      <div
        style={{
          height: '2.5rem',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-default)',
          background: value || 'transparent',
        }}
      />
      <code>{label}</code>
      <span style={{ color: 'var(--text-muted)' }}>{value || '(unset)'}</span>
    </div>
  )
}
