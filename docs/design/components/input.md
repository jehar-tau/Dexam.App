# Input

Status: Approved
Design source: `dexam-portfolio-design-system/project/components/forms/Input.*` at `4acbb1b`
Storybook: `Components/Forms/Input`

## Purpose

Collects one line of user-entered text with a persistent label and optional supporting or validation message.

## States

- Default, placeholder, focus-visible, disabled, and error
- Native input types such as email and password

## Composition rules

Every input has a visible label. Supporting guidance appears below the control, and an error replaces neither the label nor the user's value.

## Accessibility

The label is programmatically associated with the input. Hint and error text are connected with `aria-describedby`; errors also set `aria-invalid`.

## Do / Don't

Do use the appropriate input type and autocomplete value. Don't rely on placeholder text as a label or expose whether a protected account exists.

## Tokens used

Surface, text, border, focus, radius, spacing, motion, and typography tokens.
