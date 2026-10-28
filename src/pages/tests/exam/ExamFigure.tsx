import type { ExamFigureId } from '../../../features/testSeries/examPaper'
import styles from './ExamWindow.module.css'

const stroke = { stroke: 'currentColor', strokeWidth: 2, fill: 'none' }

/** Fictional practice-paper figures. Real figures come from the bank's private media (F038). */
export function ExamFigure({ id }: { id: ExamFigureId }) {
  if (id === 'cube-net') {
    const cells = [
      [60, 0],
      [0, 60],
      [60, 60],
      [120, 60],
      [180, 60],
      [60, 120],
    ]
    return (
      <svg className={styles.figure} viewBox="-2 -2 244 184" role="img" aria-label="Cube net">
        {cells.map(([x, y], index) => (
          <rect
            key={index}
            x={x}
            y={y}
            width={60}
            height={60}
            {...stroke}
            fill={index === 2 ? 'currentColor' : 'none'}
            fillOpacity={index === 2 ? 0.25 : undefined}
          />
        ))}
      </svg>
    )
  }

  if (id === 'tile-grid') {
    const shaded = new Set(['0-0', '0-2', '1-1', '1-3', '2-0', '2-2', '3-1', '3-3'])
    return (
      <svg className={styles.figure} viewBox="-2 -2 204 204" role="img" aria-label="Tile grid">
        {[0, 1, 2, 3].flatMap((row) =>
          [0, 1, 2, 3].map((col) => (
            <rect
              key={`${row}-${col}`}
              x={col * 50}
              y={row * 50}
              width={50}
              height={50}
              {...stroke}
              fill={shaded.has(`${row}-${col}`) ? 'currentColor' : 'none'}
              fillOpacity={shaded.has(`${row}-${col}`) ? 0.3 : undefined}
            />
          )),
        )}
      </svg>
    )
  }

  return (
    <svg className={styles.figure} viewBox="0 0 330 80" role="img" aria-label="Shape sequence">
      <polygon points="10,70 40,10 70,70" {...stroke} />
      <rect x="100" y="10" width="60" height="60" {...stroke} />
      <polygon points="220,8 250,30 238,70 202,70 190,30" {...stroke} />
      <text x="290" y="52" fontSize="32" fill="currentColor" textAnchor="middle">
        ?
      </text>
    </svg>
  )
}
