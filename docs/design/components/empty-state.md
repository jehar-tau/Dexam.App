# Empty State

Status: Approved
Design source: `dexam-portfolio-design-system/project/components/feedback/EmptyState.*` at `4acbb1b`
Storybook: `Components/Feedback/EmptyState`

## Purpose

Explains that a list or section has no content yet and, when useful, offers one clear next action.

## States

- Title only
- Title with supporting description
- Optional action
- Responsive by default within its container

## Composition rules

Use one short title, one explanatory sentence, and at most one action. The icon is decorative and must not carry meaning by itself.

## Accessibility

Use an accurate surrounding heading or live region when a newly completed load reveals the empty state. The optional action follows the description in keyboard order.

## Do / Don't

Do distinguish a valid empty result from loading and service failure. Don't use an empty state to hide an authorization error.

## Tokens used

Muted surface, text, border, radius, spacing, and typography tokens.
