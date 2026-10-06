# Callout

Status: Approved
Design source: `dexam-portfolio-design-system/project/components/surfaces/Callout.*` at `4acbb1b`
Storybook: `Components/Surfaces/Callout`

## Purpose

Highlights a contextual note, tip, success, or warning within the reading flow.

## States

- Tones: neutral, accent, success, warning
- Marks: note, tip, success, warning

## Composition rules

Keep copy concise. A callout supports the main task and must not replace validation messaging or a modal confirmation.

## Accessibility

The decorative mark is hidden from assistive technology. Urgent or dynamic messages must receive the appropriate live-region role at the usage site.

## Do / Don't

Do use a callout for short supporting guidance. Don't hide a required action or full section of content inside it.

## Tokens used

Semantic surface, border, text, status-color, radius, type, and spacing tokens.
