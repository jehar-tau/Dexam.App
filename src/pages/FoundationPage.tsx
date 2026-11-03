import styles from './FoundationPage.module.css'
import { PortalEntrances } from './PortalHomePage'
import { DiscoveryArt } from '../components/brand/DiscoveryArt'

const foundations = [
  ['Learn', 'Make space for new ideas, one lesson at a time.'],
  ['Make', 'Turn what you notice into work you can share.'],
  ['Grow', 'Practise, get feedback, and see your progress.'],
] as const

export function FoundationPage() {
  return (
    <section className={styles.layout} aria-labelledby="foundation-title">
      <div className={styles.hero}>
        <div>
          <p className="eyebrow">Your DEXAM learning space</p>
          <h1 id="foundation-title">
            Less reading.
            <br />
            <em>More discovering.</em>
          </h1>
          <p className={styles.intro}>
            A place to practise, make things, and find your own way of seeing. Pick your workspace
            to continue.
          </p>
        </div>
        <DiscoveryArt kind="making" className={styles.heroArt} />
      </div>
      <dl className={styles.foundations}>
        {foundations.map(([term, description]) => (
          <div className={styles.foundation} key={term}>
            <dt>{term}</dt>
            <dd>{description}</dd>
          </div>
        ))}
      </dl>
      <PortalEntrances />
    </section>
  )
}
