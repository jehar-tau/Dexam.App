import styles from './Avatar.module.css'

export type AvatarProps = {
  name?: string
  size?: 'sm' | 'md' | 'lg'
  src?: string
}

const sizeClass = {
  lg: 'large',
  md: 'medium',
  sm: 'small',
} as const

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export function Avatar({ name = '', size = 'md', src }: AvatarProps) {
  return (
    <span className={`${styles.avatar} ${styles[sizeClass[size]]}`}>
      {src ? <img className={styles.image} src={src} alt={name} /> : getInitials(name)}
    </span>
  )
}
