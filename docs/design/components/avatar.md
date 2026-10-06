# Avatar

Status: Approved
Design source: `dexam-portfolio-design-system/project/components/data/Avatar.*` at `4acbb1b`
Storybook: `Components/Data/Avatar`

## Purpose

Provides a compact visual anchor for a person using an image or generated initials.

## States

- Small 24px, medium 32px, large 44px
- Initials fallback when no image is supplied

## Composition rules

Use a real name to generate up to two initials. The avatar does not replace the person's visible text name.

## Accessibility

Images use the supplied person name as alternative text. Initials remain supporting content next to a visible full name.

## Do / Don't

Do pair the avatar with the person's visible name. Don't use it as the only identity signal or as an unexplained action.

## Tokens used

Accent surface, text, border, full-radius, and typography tokens.
