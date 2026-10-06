# Card

Status: Approved
Design source: `dexam-portfolio-design-system/project/components/surfaces/Card.*` at `4acbb1b`
Storybook: `Components/Surfaces/Card`

## Purpose

Groups related content on a quiet bordered surface.

## States

- Default and selected
- Optional interactive hover, pressed, and focus-visible states

## Composition rules

Use borders for separation and subtle shadows only. A clickable card renders as a native button; do not place another interactive element inside it.

## Accessibility

Interactive cards are keyboard-operable buttons with visible focus. Non-interactive cards remain neutral containers.

## Do / Don't

Do use a card to group one coherent block. Don't stack shadows for decoration or nest buttons inside an interactive card.

## Tokens used

`--surface-card`, `--surface-selected`, border, radius, shadow, spacing, and motion tokens.
