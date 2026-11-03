# DEXAM Discovery design system

Version 1.0 · approved by the product owner on 31 October 2026.

This is the visual direction approved on the Design Instinct assessment and the Design Exam Academy website. Apply it to the public website and the whole DexAM app. The approval explicitly replaces the earlier portfolio-derived visual theme. Keep the app's existing workflows and security boundaries.

## The character

Curious, tactile, clear, and quietly playful. It should feel like a design studio: warm paper, confident typography, useful objects, and room to think. “Less reading. More discovering.” is a principle for the experience, not a slogan to repeat on every screen.

- Use cream backgrounds, forest ink, green actions, and small orange signals.
- Pair expressive slab-serif headings with clean, readable sans-serif UI.
- Make the subject visible with original geometric illustrations.
- Prefer a clear interaction and a short instruction to an explanatory paragraph.
- Use honest, specific copy. Do not invent achievements, testimonials, results, readiness, or available features.

## Color contract

| Role         | Value     | Use                            |
| ------------ | --------- | ------------------------------ |
| Paper        | `#faf9f3` | Default page                   |
| Ink          | `#162824` | Headings and primary text      |
| Green        | `#386451` | Emphasis and artwork           |
| Action green | `#244735` | Primary controls               |
| Orange       | `#ef633d` | Tiny markers and illustrations |
| Yellow       | `#edc668` | Illustration accents           |
| Lime         | `#dceba1` | Illustration accents           |
| Soft sage    | `#f0f2e5` | Supporting panels              |
| Border       | `#dde0d4` | Quiet separation               |

Use semantic tokens in app components, not literal color values. Brand primitives belong in the token file; artwork uses the brand/art variables. Small text uses `--text-secondary` or `--text-muted`, which are deliberately darker than purely decorative sage.

Orange and yellow are not default body-text colors. Orange with white small text is not an approved action treatment. Use green with paper text, or ink on a pale accent. Status colors retain distinct success, warning, error, info, and exam-review meanings, accompanied by text or shape.

Dark mode is deep forest with paper text, lime actions, and the same orange/yellow artwork. It uses the same semantic token names; do not invert images or printed exam questions. The website remains light unless dark mode is separately requested.

## Typography

- **Zilla Slab**: display, page/section headings, wordmark, and selected large statistics. Weight 500 for headings, 700 for the wordmark. Heading tracking about -0.035em; line height 1.08–1.25.
- **Figtree**: body, navigation, controls, forms, lists, tables, instructional copy. Weights 400–700.
- **System monospace**: IDs, timers, code, numerical exam data. Do not use it for every card description.
- Italic green emphasis belongs in occasional editorial headings. Do not italicize operational labels, questions, error messages, or whole paragraphs.
- App body 16px; secondary UI 15px; captions 13px; micro labels 12px. Marketing may use the approved tighter scale, but the app must remain readable.
- App page headings 36–56px, section headings 26–32px, card headings 22px. Responsive sizes are tokens. Large display type belongs on an entrance, not in every tool.
- Keep text selectable. Use real text for instructions; decorative artwork must not contain essential information.

## Space and surfaces

Use the 4px spacing scale: 4, 8, 12, 16, 20, 24, 32, 48, 64, 96.

- Page width: roughly 1040–1200px for workspaces; narrow forms around 480–560px.
- App page gutters: 16–24px on phones and 32–64px on desktop.
- Cards: 20–32px padding; 10–12px corner radius; 1px quiet border. Let borders do most of the work.
- Controls: 6px radius; 44px minimum main target. Pills are for filters, segmented choices, tags, and statuses.
- Shadows are subtle and reserved for elevation. Avoid gradients, glass, glow, oversized floating cards, heavy drop shadows, and gratuitous rotations.
- Layout reflows from columns to a single column. Allow horizontal scrolling inside a data table when necessary, never the whole page.
- Keep working tools dense enough to use. Decorative space must not push a timer, answer, validation message, or next action out of reach.

## Components and behavior

Use the existing Button, Card, Badge, Callout, Input, EmptyState, DataRow, Avatar, and portal shells. Shared primitives own styling; feature modules own layout.

- One leading action per section. Secondary actions use a quiet outline or text.
- Buttons have text labels, real button/link semantics, hover/active/focus/disabled states, and pending feedback.
- Inputs have persistent labels, helpful validation, readable errors, and visible keyboard focus.
- Selected controls are recognizable by more than color: weight, a check, border, or pressed/current state.
- Empty states have one small illustration, a concise explanation, and an available next action.
- Loading/error/offline states preserve context. Never make a decorative interaction imitate a working product feature.
- All popovers, overlays, navigation, forms, and test interactions work by keyboard. Respect reduced motion.
- App theme preference, access checks, routes, timers, assessment logic, uploads, private data, and payment rules keep their established behavior.

## Illustration language

Original code-native SVG, rather than generic stock icons or copied reference artwork. Use flat geometric shapes and recognizable objects: a chair and lamp, a poster, a room, a letterform, or a paper study.

- Palette: paper, green, orange, yellow, sage, lime.
- Thin, purposeful green lines; simple dimensional construction; restrained rotation for paper objects.
- A useful object or composition is the subject. Avoid random blobs and decorative emoji.
- Usually one scene per page header and one small scene per discovery card.
- Art scales with a viewBox, has no external requests, and remains clear at phone sizes.
- Decorative SVG uses `aria-hidden` and does not intercept input. Meaningful interactive diagrams require labels, keyboard equivalents, and instructions.
- Keep printed exam content on its original white surface. Brand illustrations never modify question imagery or imply an answer.

References such as Brilliant, Kern Type, and Bézier games inform learning through action. Do not copy their code, logos, artwork, question content, or distinctive branded assets.

## Voice

Short, concrete, and inviting. “Choose an exam.” “Continue practice.” “Your work is saved.” Explain only what helps the next decision. Use a human tone without baby talk, fabricated encouragement, or certainty about someone's design career.

## Implementation map

Website:

- `src/site/academy.css`: approved website tokens and layouts.
- `src/site/Art.jsx` and `src/assessment/Graphics.jsx`: original visual language.
- `src/site/components.jsx`: shared public patterns.
- `DESIGN_SYSTEM.md`: this versioned contract.

DexAM app:

- `src/styles/discovery.css`: active light/dark semantic tokens.
- `src/styles/tokens.css`: import entry point; historical spacing is reused.
- `src/styles/global.css`: typography and baseline.
- `src/components/brand/`: Brand and DiscoveryArt.
- `src/components/`: existing shared accessible primitives.
- Storybook → Foundations / Discovery: brand, illustrations, and full light/dark specimens.
- `docs/design/discovery.tokens.json`: versioned machine-readable brand contract.
- `pnpm design:tokens`: checks that the active theme matches that contract.

The older `src/styles/design-system/` bundle is retained with its provenance for history. Its colors, typefaces, and effects are no longer imported. The dormant Figma generator must not replace the active theme. The shared portfolio repository is not the current DEXAM visual authority.

## Future changes

1. Read this contract before creating or restyling a screen.
2. Reuse a token and approved component first.
3. For a new reusable pattern, add a component spec and a Storybook example covering relevant states.
4. Check desktop and 390px mobile, keyboard, contrast, reduced motion, and both app themes.
5. Run the repository's quality gates and review screenshots. Styling must not change access, scoring, or commercial rules.
6. Changes to visual direction require owner approval. Increment the version and update this contract and tokens in both repositories together; record the approval. Do not silently drift back to the old theme.
