# DECISION REQUIRED — D-033

Status: Awaiting owner decision; no progress implementation authorized

## Question

What should count as a student's topic progress in the next academic slice?

## Why this needs your decision

F005 deliberately records no lesson-view analytics or completion evidence. Assignment submission/teacher feedback already have their own statuses and must not silently become proof of mastery. DW-008 requires an explicit meaning and visibility boundary before storing progress.

## Options

### A — Keep coursework browsing only

Defer progress tracking; students continue using existing coursework and assignment status. ₹0 additional vendor spending for fictional/local work, smallest scope, but no study checklist. Reversible through a later decision.

### B — Private student-controlled topic checklist (recommended)

An active owning student marks an assigned published topic as studied, or undoes the mark. Clearly label this self-reported, not a grade, attendance, teacher endorsement or course completion. Show the checklist only to that student; no staff reporting, automatic read tracking, scoring, percentages or reminders. Store the current mark and timestamps against the exact enrolment/curriculum topic, not a contact profile. Course closeout stops changes; the own checklist is readable only within the same bounded archive window, without reopening lessons. Expire identifiable checklist records 12 months after course end. ₹0 additional vendor spending on the existing stack for fictional/local work; more authorization/retention tests. Disabling the interface is reversible, but actual data deletion is not.

### C — Define teacher-verified progress before building

First specify demonstrated completion criteria, teacher scope, student correction/appeal, reporting and retention. This would require a new teacher-authority decision beyond D-031 A and may take more discovery. ₹0 additional vendor spending for discovery; larger implementation and privacy scope. No automatic mastery claims or monitoring are implied.

## Recommendation

B offers a simple planning aid without claiming academic achievement or increasing teacher permissions. It avoids collecting passive reading behavior and keeps assignment evaluation separate.

## What can continue while pending

Finish F019 release verification and low-risk engineering checks. Do not add progress storage, analytics or new student/staff behavior until the owner chooses. Real personal data, production, paid services and external delivery remain prohibited.
