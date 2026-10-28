# F045 — Part A shortlisting likelihood (interim formula v1)

Status: Implemented locally 2026-10-28 under D-054 A and D-057; in review. **Interim:** the formula and wording are the owner's Decision Gate. Until the owner decides, this v1 ships as a recommended default, always labelled a Dexam estimate.

## What it says

UCEED and CEED shortlist candidates on Part A alone; Part B is marked only for shortlisted candidates. The official cut-off is δ = μ + σ/2 of all candidates' Part A marks (OPEN), 0.9δ for OBC-NCL/EWS and 0.5δ for SC/ST/PwD (UCEED 2026 brochure §17.4; CEED 2026 brochure §1.1). IIT Bombay publishes μ and σ every year.

The band compares the student's Part A score, scaled to the official maximum (UCEED 200, CEED 150), with the last four years' cut-offs for the chosen category:

| Band   | Meaning                                       |
| ------ | --------------------------------------------- |
| High   | At or above every year's cut-off (2023–2026). |
| Medium | At or above at least one year's cut-off.      |
| Low    | Below every year's cut-off.                   |

Cut-offs used (computed from the published μ and σ, rounded half-up to 2 dp):

| Exam  | 2026  | 2025  | 2024  | 2023  |
| ----- | ----- | ----- | ----- | ----- |
| UCEED | 83.75 | 74.35 | 55.43 | 69.89 |
| CEED  | 47.80 | 53.97 | 50.26 | 28.50 |

The 2026 formula is verified in both brochures; for 2023–2025 the same formula is assumed (workstation `docs/BLUEPRINTS_2026_DRAFT.md` §6). From 2027, UCEED also caps shortlisting at the top 6,400 and adds a Part B qualifying mark; v1 does not model that.

**Wording** on the result page: "Part A shortlisting likelihood", the band, the scaled score and how many years it clears, the cut-offs, and "Dexam estimate (v1), not an official prediction. Shortlisting only means Part B gets marked; the final rank also depends on Part B."

## Where it shows

- **Result page:** for papers, mocks and live mocks of UCEED and CEED. The student picks a category (OPEN by default). The choice is kept only in this browser and never sent to the server.
- **Analytics history:** a Band column, using the same category.
- **Overview:** the band of the latest paper or mock.

Practice sets get no band. NID and NIFT publish no cut-offs, so they get no band yet. A cohort-percentile band for them needs enough Dexam attempts and is left for a later version.

## Verification

- Vitest `likelihood.test.ts`: reproduces every published cut-off for all three categories; band boundaries; scaling a shortened paper; no band for NID, NIFT or a zero maximum.
- Result page test: the band, wording and category switch. The Analytics test checks the Band column.
