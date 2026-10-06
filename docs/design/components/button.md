# Button

Status: Approved
Design source: `dexam-portfolio-design-system/project/components/core/Button.*` at `4acbb1b`
Storybook: `Components/Core/Button`

## Purpose

Triggers a clear user action. Use one primary action per decision area; use secondary, ghost, and link variants to reduce competing emphasis.

## States

- Variants: primary, secondary, ghost, link
- Sizes: 32px small and 44px default
- Hover, active, focus-visible, and disabled are implemented

## Composition rules

Buttons use an 8px radius and never use pill styling or scale animations. Action labels begin with a verb. Primary orange is reserved for the most important action.

## Accessibility

Native `button` semantics, visible focus ring, and a 44px default touch target. Loading actions must remain disabled and announce their changed label.

## Do / Don't

Do use a primary button for the single leading action. Don't use pill shapes, scale-on-press animation, or multiple competing primary buttons.

## Tokens used

`--accent-primary`, `--surface-card`, `--surface-hover`, `--border-strong`, `--radius-md`, `--hit-target-min`, motion tokens.
