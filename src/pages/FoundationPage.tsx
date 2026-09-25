import styles from './FoundationPage.module.css'

const foundations = [
  ['Frontend', 'React, Vite and strict TypeScript'],
  ['Backend', 'Supabase and PostgreSQL with Row Level Security'],
  ['Verification', 'Unit, integration and browser testing'],
] as const

export function FoundationPage() {
  return (
    <section className={styles.layout} aria-labelledby="foundation-title">
      <div>
        <p className={styles.eyebrow}>Development foundation</p>
        <h1 id="foundation-title">The Dexam platform starts here.</h1>
        <p className={styles.intro}>
          This temporary screen confirms that the application shell is healthy. Product interfaces
          will be designed through approved feature specifications.
        </p>
      </div>
      <dl className={styles.foundations}>
        {foundations.map(([term, description]) => (
          <div className={styles.foundation} key={term}>
            <dt>{term}</dt>
            <dd>{description}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
