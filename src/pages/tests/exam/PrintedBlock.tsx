import type { ExamImage } from '../../../features/testSeries/examPaper'
import styles from './PrintedBlock.module.css'

/**
 * D-060: a question shown exactly as printed in the source paper (a reviewed crop of the page),
 * with its text kept for screen readers.
 */
export function PrintedBlock({
  image,
  prompt,
  label,
}: {
  image: ExamImage
  prompt: string
  label: string
}) {
  return (
    <figure className={styles.block}>
      <img
        className={styles.image}
        src={image.src}
        width={image.width ?? undefined}
        height={image.height ?? undefined}
        alt={`${label}, as printed`}
        draggable={false}
      />
      <figcaption className={styles.text}>{prompt}</figcaption>
    </figure>
  )
}
