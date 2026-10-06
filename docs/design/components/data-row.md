# Data Row

Status: Approved
Design source: `dexam-portfolio-design-system/project/components/data/DataRow.*` at `4acbb1b`
Storybook: `Components/Data/DataRow`

## Purpose

Presents a primary label, optional supporting line, and compact trailing metadata in a list.

## States

- Static
- Optional interactive hover, pressed, and focus-visible states

## Composition rules

Keep the primary label to one line. Use metadata for identifiers or dates, not a second primary action. A clickable row renders as one native button.

## Accessibility

Interactive rows are keyboard-operable. The full row has one action; nested controls are not allowed.

## Do / Don't

Do keep one clear primary label and compact metadata. Don't overload a row with multiple actions or paragraphs of copy.

## Tokens used

Surface, text, mono type, spacing, radius, and motion tokens.
