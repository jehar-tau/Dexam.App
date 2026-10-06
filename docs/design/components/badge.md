# Badge

Status: Approved
Design source: `dexam-portfolio-design-system/project/components/core/Badge.*` at `4acbb1b`
Storybook: `Components/Core/Badge`

## Purpose

Labels status or category in compact supporting content.

## States

- Tones: neutral, accent, success, warning, danger
- Optional pill shape for status chips

## Composition rules

Badges contain short text and never act as controls. Color must always be paired with a readable label. Pill styling is allowed here because badges are compact metadata.

## Accessibility

Status meaning is present in text, not color alone. Use a live region separately when a status changes dynamically.

## Do / Don't

Do use concise labels such as “Approved.” Don't use a badge as a button or communicate meaning through color alone.

## Tokens used

Semantic surface, text, border, status-color, radius, and type tokens.
