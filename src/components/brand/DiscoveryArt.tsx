import styles from './DiscoveryArt.module.css'

export type DiscoveryArtKind = 'seeing' | 'making' | 'space' | 'type' | 'growth'

/** Original DEXAM artwork. Decorative: the surrounding heading supplies the meaning. */
export function DiscoveryArt({
  kind = 'seeing',
  className = '',
}: {
  kind?: DiscoveryArtKind
  className?: string
}) {
  return (
    <svg
      className={`${styles.art} ${className}`}
      viewBox="0 0 320 220"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {kind === 'seeing' ? (
        <>
          <g transform="rotate(-9 145 110)">
            <rect
              x="62"
              y="20"
              width="138"
              height="182"
              rx="3"
              fill="var(--art-paper)"
              stroke="var(--art-line)"
            />
            <path d="M83 152V96a48 48 0 0 1 96 0v56" fill="var(--brand-yellow)" />
            <circle cx="131" cy="106" r="35" fill="var(--brand-orange)" />
            <circle cx="131" cy="106" r="15" fill="var(--art-paper)" />
            <path d="M82 150h98v27H82Z" fill="var(--brand-green)" />
            <path d="m84 177 16-25 16 25 16-25 16 25 16-25 16 25" stroke="var(--brand-lime)" />
            <path d="M83 37h46M83 42h24" stroke="var(--art-line)" />
          </g>
          <g transform="rotate(12 229 136)">
            <rect x="195" y="81" width="73" height="113" rx="3" fill="var(--brand-orange)" />
            <circle cx="232" cy="119" r="22" fill="var(--brand-yellow)" />
            <path d="M210 161h40m-40 8h25" stroke="var(--brand-paper)" strokeWidth="2" />
          </g>
          <path d="m270 37 4 12 12 4-12 4-4 12-4-12-12-4 12-4Z" fill="var(--art-line)" />
        </>
      ) : kind === 'making' ? (
        <>
          <ellipse cx="157" cy="191" rx="118" ry="8" fill="var(--art-sage)" opacity=".3" />
          <path d="m84 155-9 39m94-39 9 39" stroke="var(--art-line)" strokeWidth="5" />
          <path d="M78 72q0-12 12-12h78q12 0 12 12v75H78Z" fill="var(--brand-green)" />
          <path d="M91 72h76v64H91Z" fill="var(--art-sage)" />
          <rect x="66" y="132" width="125" height="31" rx="10" fill="var(--brand-orange)" />
          <path d="M77 141h101" stroke="var(--brand-paper)" opacity=".5" />
          <path d="M244 181V67" stroke="var(--art-line)" strokeWidth="3" />
          <path d="M215 74h58l-14-41h-31Z" fill="var(--brand-yellow)" />
          <ellipse cx="244" cy="183" rx="23" ry="5" fill="var(--brand-green)" />
          <path d="M37 42h24M37 50h14" stroke="var(--art-line)" />
        </>
      ) : kind === 'space' ? (
        <>
          <path d="m57 148 103-59 104 59-104 61Z" fill="var(--brand-yellow)" />
          <path d="M57 148V62L160 3v86Z" fill="var(--art-sage)" />
          <path d="M160 89V3l104 59v86Z" fill="var(--art-paper)" stroke="var(--art-sage)" />
          <path d="m79 100 43-25V34L79 59Z" fill="var(--brand-paper)" />
          <path d="m94 146 63-36 60 35-63 37Z" fill="var(--brand-green)" />
          <path
            d="m94 146 60 36v19l-60-35Zm60 36 63-37v19l-63 37Z"
            fill="var(--brand-green)"
            opacity=".75"
          />
          <path d="m201 169 26-15 25 14-26 15Z" fill="var(--brand-orange)" />
          <path
            d="m201 169 25 14v12l-25-14Zm25 14 26-15v12l-26 15Z"
            fill="var(--brand-orange)"
            opacity=".7"
          />
          <path
            d="M236 119V83m-14 6 14-19 14 19-14 8Z"
            stroke="var(--art-line)"
            fill="var(--brand-yellow)"
            strokeWidth="2"
          />
        </>
      ) : kind === 'type' ? (
        <>
          <g transform="rotate(-7 160 110)">
            <rect
              x="59"
              y="34"
              width="201"
              height="155"
              fill="var(--art-paper)"
              stroke="var(--art-line)"
            />
            <path d="M79 54h46M79 60h22" stroke="var(--art-line)" />
            <text
              x="79"
              y="143"
              fill="var(--brand-green)"
              fontFamily="var(--font-serif)"
              fontSize="93"
              fontWeight="500"
            >
              Aa
            </text>
            <circle cx="226" cy="64" r="16" fill="var(--brand-orange)" />
            <path d="M81 164h147" stroke="var(--art-line)" />
          </g>
          <path
            d="m246 171 31-73 9 4-31 73-10 9Z"
            fill="var(--brand-yellow)"
            stroke="var(--art-line)"
          />
          <path d="m246 175-1 9 7-6Z" fill="var(--brand-green)" />
        </>
      ) : (
        <>
          <path d="M60 182h207" stroke="var(--art-line)" />
          <path d="M82 180v-36h43v36" fill="var(--art-sage)" />
          <path d="M138 180v-69h43v69" fill="var(--brand-yellow)" />
          <path d="M194 180V72h43v108" fill="var(--brand-green)" />
          <path
            d="m87 119 60-43 49 9 51-49m-27 0h27v27"
            stroke="var(--brand-orange)"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <circle cx="80" cy="52" r="16" fill="var(--brand-lime)" />
          <path d="m73 52 5 5 9-10" stroke="var(--brand-green)" strokeWidth="2" />
        </>
      )}
    </svg>
  )
}
