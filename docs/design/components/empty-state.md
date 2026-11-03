# Empty State

Status: Approved
Visual authority: [Discovery 1.0](../DISCOVERY.md), D-064. Historical behavior source: `dexam-portfolio-design-system/project/components/feedback/EmptyState.*` at `4acbb1b`.
Storybook: `Components/Feedback/EmptyState`

## Purpose

Explains that a list or section has no content yet and, when useful, offers one clear next action.

## States

- Title only
- Title with supporting description
- Optional action
- Responsive by default within its container

## Composition rules

Use one short slab-serif title, one explanatory sentence, and at most one action. The default is a small original DiscoveryArt scene; a caller may supply a decorative icon instead. Neither carries essential meaning. Use a quiet sage panel with a solid border and 10px corners.

## Accessibility

Use an accurate surrounding heading or live region when a newly completed load reveals the empty state. The optional action follows the description in keyboard order.

## Do / Don't

Do distinguish a valid empty result from loading and service failure. Don't use an empty state to hide an authorization error.

## Tokens used

Muted surface, text, border, radius, spacing, and typography tokens.
