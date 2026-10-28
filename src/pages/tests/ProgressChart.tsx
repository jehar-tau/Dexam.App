import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'

import styles from './ProgressChart.module.css'

/**
 * F046 progress chart: score % over time, one line per exam. Colours follow the exam (fixed
 * order, validated for colour-blind separation); every line is also labelled at its end, and
 * the attempt history table below is the chart's table view.
 */

export type ProgressPoint = { id: string; time: number; percent: number; label: string }
export type ProgressSeries = { key: string; name: string; points: ProgressPoint[] }

const HEIGHT = 260
const PAD = { top: 16, right: 72, bottom: 32, left: 44 }
const seriesClass: Record<string, string | undefined> = {
  uceed: styles.series1,
  ceed: styles.series2,
  nid: styles.series3,
  nift: styles.series4,
}

const dateLabel = (time: number) =>
  new Date(time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(720)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(200, Math.round(entry.contentRect.width)))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return { ref, width }
}

export function ProgressChart({ series }: { series: ProgressSeries[] }) {
  const { ref, width } = useWidth()
  const [active, setActive] = useState<number | null>(null)

  const all = series.flatMap((entry) => entry.points)
  const times = [...new Set(all.map((point) => point.time))].sort((a, b) => a - b)
  const minTime = times[0] ?? 0
  const maxTime = times.at(-1) ?? 0
  const low = Math.min(0, ...all.map((point) => Math.floor(point.percent / 25) * 25))
  const plotWidth = width - PAD.left - PAD.right
  const plotHeight = HEIGHT - PAD.top - PAD.bottom

  const x = (time: number) =>
    maxTime === minTime
      ? PAD.left + plotWidth / 2
      : PAD.left + ((time - minTime) / (maxTime - minTime)) * plotWidth
  const y = (percent: number) => PAD.top + ((100 - percent) / (100 - low)) * plotHeight
  const ticks = [100, 75, 50, 25, 0, -25, -50].filter((tick) => tick >= low)

  const activeTime = active === null ? null : (times[active] ?? null)
  const activeRows =
    activeTime === null
      ? []
      : series.flatMap((entry) =>
          entry.points
            .filter((point) => point.time === activeTime)
            .map((point) => ({ entry, point })),
        )

  function onPointer(clientX: number, element: SVGSVGElement) {
    const box = element.getBoundingClientRect()
    const px = ((clientX - box.left) / box.width) * width
    let nearest = 0
    times.forEach((time, index) => {
      if (Math.abs(x(time) - px) < Math.abs(x(times[nearest]!) - px)) nearest = index
    })
    setActive(nearest)
  }

  function onKey(event: KeyboardEvent) {
    if (!times.length) return
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault()
      const step = event.key === 'ArrowRight' ? 1 : -1
      setActive((value) =>
        Math.min(times.length - 1, Math.max(0, (value ?? (step > 0 ? -1 : times.length)) + step)),
      )
    } else if (event.key === 'Escape') setActive(null)
  }

  return (
    <div className={styles.root}>
      {series.length > 1 ? (
        <ul className={styles.legend} aria-label="Exams">
          {series.map((entry) => (
            <li key={entry.key}>
              <span
                className={`${styles.key} ${seriesClass[entry.key] ?? ''}`}
                aria-hidden="true"
              />
              {entry.name}
            </li>
          ))}
        </ul>
      ) : null}
      <div ref={ref} className={styles.frame}>
        <svg
          className={styles.svg}
          width={width}
          height={HEIGHT}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          role="img"
          aria-label="Score percentage over time. Use the left and right arrow keys to read each attempt; the history table lists every value."
          tabIndex={0}
          onPointerMove={(event) => onPointer(event.clientX, event.currentTarget)}
          onPointerLeave={() => setActive(null)}
          onKeyDown={onKey}
          onBlur={() => setActive(null)}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                className={tick === 0 ? styles.baseline : styles.grid}
                x1={PAD.left}
                x2={PAD.left + plotWidth}
                y1={y(tick)}
                y2={y(tick)}
              />
              <text
                className={styles.axis}
                x={PAD.left - 8}
                y={y(tick)}
                dy="0.32em"
                textAnchor="end"
              >
                {tick}%
              </text>
            </g>
          ))}
          {times.length ? (
            <>
              <text className={styles.axis} x={x(minTime)} y={HEIGHT - 8} textAnchor="start">
                {dateLabel(minTime)}
              </text>
              {maxTime !== minTime ? (
                <text className={styles.axis} x={x(maxTime)} y={HEIGHT - 8} textAnchor="end">
                  {dateLabel(maxTime)}
                </text>
              ) : null}
            </>
          ) : null}

          {activeTime !== null ? (
            <line
              className={styles.crosshair}
              x1={x(activeTime)}
              x2={x(activeTime)}
              y1={PAD.top}
              y2={PAD.top + plotHeight}
            />
          ) : null}

          {series.map((entry) => {
            const path = entry.points
              .map((point, index) => `${index ? 'L' : 'M'}${x(point.time)},${y(point.percent)}`)
              .join(' ')
            const last = entry.points.at(-1)
            return (
              <g key={entry.key} className={seriesClass[entry.key]}>
                {entry.points.length > 1 ? <path className={styles.line} d={path} /> : null}
                {entry.points.map((point) => (
                  <circle
                    key={point.id}
                    className={`${styles.marker} ${point.time === activeTime ? styles.markerActive : ''}`}
                    cx={x(point.time)}
                    cy={y(point.percent)}
                    r={point.time === activeTime ? 6 : 4.5}
                  />
                ))}
                {last ? (
                  <text
                    className={styles.endLabel}
                    x={x(last.time) + 10}
                    y={y(last.percent)}
                    dy="0.32em"
                  >
                    {entry.name} {Math.round(last.percent)}%
                  </text>
                ) : null}
              </g>
            )
          })}
        </svg>
        {activeTime !== null && activeRows.length ? (
          <div
            className={styles.tooltip}
            style={{
              left: Math.min(width - 200, Math.max(0, x(activeTime) + 12)),
              top: PAD.top,
            }}
            role="status"
          >
            <span className={styles.tooltipDate}>{dateLabel(activeTime)}</span>
            {activeRows.map(({ entry, point }) => (
              <span key={point.id} className={styles.tooltipRow}>
                <span
                  className={`${styles.tooltipKey} ${seriesClass[entry.key] ?? ''}`}
                  aria-hidden="true"
                />
                <strong>{Math.round(point.percent)}%</strong>
                <span>{point.label}</span>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
