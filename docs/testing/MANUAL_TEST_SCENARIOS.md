# Manual test scenarios — every persona

Use these on the **local demo copy** (fictional data only). Nothing here touches real students or the live site.

## Before you start

- **Two browser addresses:**
  - `http://127.0.0.1:5183`: the demo accounts sign in with email or Member ID and the shared demo password.
  - `http://127.0.0.1:5182`: your own Google account, which holds Admin, Sales and Teacher. Use it for the Admin portal.
- **Logins:** every name, Member ID and the shared demo password are in `.demo-logins.md` at the project root. That file stays on this computer.
- **Two people at once:** to act as two people at the same time (for example a student and a teacher), use one normal window and one private/incognito window. Each window keeps its own sign-in.
- **Recording results:** for each scenario, note **Pass**, **Fail** or **Confusing**, plus a sentence on what you expected.

### Who is who in the demo

| Persona         | Account                                                                                       | What they can do                                                           |
| --------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Student         | Any student in `.demo-logins.md`                                                              | Coursework, assignments, classes, notifications, work archive              |
| Teacher         | Priya Nair (NID: both batches), Arjun Desai (NID and UCEED), Kavya Iyer (UCEED and Portfolio) | Lessons & assignments, Assign to students, Review & feedback, Batches      |
| Sales           | Neha Kulkarni, Rohan Mehta                                                                    | CRM, Batches, Google sign-in list, Payments                                |
| Enrolment admin | Vikram Shah                                                                                   | CRM assignment, Handoffs, Enrolments, Payments, Course closeout, Classes   |
| Admin           | Your Google account on 5182 (Aditi Rao exists as data)                                        | Courses, Payment ledger, Google sign-in list (revoke), Admissions, Privacy |

### What the demo already contains

- **NID B.Des 2027 — Full course** has two batches:
  - **Weekend studio · Nov 2026:** Aarav, Diya, Kabir, Ananya, Vihaan.
  - **Weekday evenings · Dec 2026:** Saanvi, Arnav, Meera.
- **UCEED 2027 Crash course** has one batch: Ishita, Reyansh, Tara, and Ishaan (just converted from a lead, not yet activated).
- **Design Portfolio Programme** has one batch: Aditya, Zara, Nikhil.
- **Submissions:**
  - Already reviewed: Aarav, Ananya, Arnav, Reyansh, Zara.
  - Waiting for review: Diya, Vihaan, Meera, Tara, Nikhil.
  - Not submitted yet: Kabir, Saanvi, Ishita, Aditya.
- **Payments:**
  - Arnav and Nikhil have paid nothing.
  - Vihaan and Ishita paid half the admission fee.
  - Diya's admission fee is ₹500 short after an admin correction.
  - Kabir has a scholarship fee of ₹1,20,000.

---

## Part A — End-to-end journeys (do these first)

### A1. One assignment, from creation to feedback

People: Priya (teacher) in window 1; Kabir (student, Weekend studio) in window 2.

1. **Priya → Teacher home.** Expect three cards: _1. Create_, _2. Assign_, _3. Give feedback_.
2. **Priya → Lessons & assignments.**
   1. Course offering: _NID B.Des 2027_.
   2. Choose topic _Perspective_, then the **Assignments** tab, then **New assignment**.
   3. Fill in a title (for example "Street corner in two-point perspective"), instructions and a rubric. Save, then publish it.
   - Expect it listed as _Published · v1_. Students do **not** see it yet.
3. **Priya → Assign to students.**
   1. Programme: _NID B.Des 2027_. Published assignment: your new one.
   2. Release to: _Cohort_, then _Weekend studio · Nov 2026_.
   3. Set a due date, add a release note, then **Release assignment**.
   - Expect it under _Recent releases_.
4. **Kabir → Notifications.** Expect an alert about the new assignment.
5. **Kabir → Assignments.**
   1. Open the new assignment, then **Start submission**.
   2. Add a PDF or photo, then **Submit**.
   - Expect _Uploaded privately_ and the status _Submitted_.
6. **Priya → Review & feedback.** Expect Kabir's work in the queue, showing his batch name.
7. Open Kabir's work and view the file. Under _Written feedback_, type feedback, then **Save private draft**.
   - Kabir must **not** see a draft. Check from window 2.
8. **Publish & complete review.** Expect the item to leave Priya's queue.
9. **Kabir → Assignments**, then the same assignment. Expect _Teacher feedback_ showing Priya's text.

### A2. Asking a student to redo work

People: Priya; Diya (Weekend studio, already submitted and waiting).

1. **Priya → Review & feedback → Diya.** Write feedback. Under _Choose the student's next step_, enter a correction reason, then **Publish & request correction**.
2. **Diya → Assignments.**
   - Expect the feedback and the request to correct it.
   - Expect a way to submit again (**Submit another attempt**).
3. **Diya** submits a new file.
4. **Priya → Review & feedback.**
   - Expect Diya again, now _Attempt 2_.
   - Expect her earlier feedback to be visible for reference.

### A3. Telling batches apart (several batches, one teacher)

Person: Priya, who teaches both NID batches.

1. **Review & feedback.**
   - Open the **Batch** filter. Expect _All batches_ plus _Weekend studio · Nov 2026_ and _Weekday evenings · Dec 2026_.
   - Each card in the queue also shows the student's batch.
2. Choose _Weekday evenings_. Expect only Meera.
3. Choose _Weekend studio_. Expect Diya and Vihaan.
4. **Assign to students.** Release to _Selected students_. Expect a student list where you can tick, for example, only Saanvi for extra practice.

### A4. Moving a student to another batch

People: Neha (Sales) or Priya (teacher); then the student.

1. **Priya → Batches**, choose _NID B.Des 2027_, then **Place students**.
2. Find Kabir (Weekend studio). Choose _Weekday evenings · Dec 2026_, enter a reason ("Prefers evenings"), then **Move**.
   - Expect a confirmation; Kabir is now listed under Weekday evenings.
3. **Priya → Review & feedback.** Kabir's earlier work now shows the new batch name.
4. **Kabir → Home and Class agenda.** Expect the batch name and classes to change, and **no batch dates** shown.
5. **Negative test:** sign in as Kavya (she doesn't teach NID). She must not be able to move Kabir.

### A5. From enquiry to a paying student who can sign in

People: Neha (Sales), Vikram (enrolment admin), then your Google admin account.

1. **Neha → CRM → Add enquiry.** Create a fictional lead, then move it through _Contact in progress_, _Engaged_ and _Qualified_, logging an activity and a follow-up each time.
2. **Neha:** **Request enrolment review** on that lead.
3. **Vikram → Handoffs.**
   1. Open the request and choose **Create a new student** (or match an existing student).
   2. Pick the course and batch, enter an approval reason, then **Approve enrolment**.
4. **Vikram → Enrolments.** Find the new student, then **Issue activation pack**.
   - Expect a Member ID and a one-time activation link.
   - This would normally be handed to the student; the student then sets their own password at the link.
5. **Neha → Payments.** Find the new student and record an admission fee: amount, date, method, transaction ID and **Collected by**. Optionally attach a receipt photo.
6. **Neha → Google sign-in list.** Add the student's Google email. Expect _Waiting for first sign-in_ (or _Admission fee pending_ if the fee is short).
7. **You (Google admin on 5182) → Payment ledger.** Expect the new payment, with who collected it and who recorded it.

### A6. Payment controls Dexam App access

1. **Neha → Google sign-in list.** Search _Arnav_. Expect him not listed, or _Admission fee pending_ if you add him (he hasn't paid).
2. **Neha → Payments → Arnav.** Record the full admission fee (₹10,000).
3. **Google sign-in list.** Arnav, once added, shows _Waiting for first sign-in_.
4. **Diya:** she is listed but ₹500 short after a correction, so she shows _Admission fee pending_. Record ₹500 and check that the status changes.

---

## Part B — Student

| #   | Scenario                  | Steps                                                                    | Expected                                                                       |
| --- | ------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| S1  | Sign in                   | `/sign-in` on 5183, using a Member ID and the demo password              | Lands on _Welcome, …_, with the Member ID shown                                |
| S2  | Wrong password            | Same, with a wrong password                                              | Generic error; nothing reveals whether the Member ID exists                    |
| S3  | Coursework                | **Coursework**                                                           | Sections, topics and lessons for _their_ course only                           |
| S4  | Assignments list          | **Assignments**                                                          | _Assigned_ and _Needs action_ counts, due dates, and _Late_ after the due date |
| S5  | Submit work               | Open an assignment, **Start submission**, add a PDF or image, **Submit** | _Submitted_, with the file listed                                              |
| S6  | Upload limits             | Try a very large file or an unsupported type                             | Clear refusal, and the draft stays safe                                        |
| S7  | Read feedback             | As Aarav, open the reviewed assignment                                   | Teacher feedback visible; a voice note if one was added                        |
| S8  | Class agenda              | **Class agenda**                                                         | Upcoming classes for their batch, with time, place and _Scheduled_ status      |
| S9  | Notifications             | **Notifications**                                                        | Assignment, feedback and class alerts; they can be marked read                 |
| S10 | Study checklist           | **Study checklist**                                                      | Topics can be ticked; private to the student                                   |
| S11 | Work archive              | **Work archive**                                                         | Their own submitted files, downloadable                                        |
| S12 | No other students' data   | Try opening another student's assignment link                            | Refused                                                                        |
| S13 | No dates of batch         | Home and agenda                                                          | Batch name only; no batch start or end dates                                   |
| S14 | Mock test / Practice tabs | Open them                                                                | Placeholders until the Mock Test backend is connected (DW-054)                 |
| S15 | Phone layout              | Repeat S3 to S5 on a phone or a narrow window                            | Menu collapses; no sideways scrolling                                          |

## Part C — Teacher

| #   | Scenario                       | Steps                                                            | Expected                                                                        |
| --- | ------------------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| T1  | Teacher home guide             | Sign in as Priya                                                 | Create, assign, feedback and batch cards, each with a working button            |
| T2  | Only own courses               | Kavya → Lessons & assignments, open the course list              | UCEED and Portfolio only, not NID                                               |
| T3  | Edit a published curriculum    | Lessons & assignments, then **Create editable curriculum**       | An editable draft copy; the published version stays unchanged until republished |
| T4  | Add a lesson and attach a file | In the draft, add a lesson, attach a PDF and name it             | File listed with its name                                                       |
| T5  | New assignment                 | Topic → **Assignments** tab → **New assignment** → publish       | _Published · v1_                                                                |
| T6  | Assign to a batch              | **Assign to students** → _Cohort_                                | _Recent releases_ updated; students notified                                    |
| T7  | Assign to chosen students      | Same, with _Selected students_, ticking 1–2 students             | Only those students receive it                                                  |
| T8  | See submissions by batch       | **Review & feedback** → **Batch** filter                         | Queue narrows to that batch; _Awaiting review_ count changes                    |
| T9  | Open a student's work          | Click a queue card                                               | Student name, Member ID, batch, attempt number, files viewable in the page      |
| T10 | Written feedback and draft     | Type, then **Save private draft**                                | Saved; the student can't see it                                                 |
| T11 | Voice note                     | Record, stop, play back, publish                                 | Student hears the voice note                                                    |
| T12 | Complete the review            | **Publish & complete review**                                    | Leaves the queue; the student sees the feedback                                 |
| T13 | Request a correction           | Enter a correction reason, then **Publish & request correction** | Student can resubmit; the item returns as a new attempt                         |
| T14 | Move a student's batch         | **Batches** → **Place students** → **Move**, with a reason       | Moved; the history keeps the reason                                             |
| T15 | Cannot create batches          | **Batches** as a teacher                                         | Placement only; no _Create a batch_ form                                        |
| T16 | No Sales or Admin tools        | Look at the menu                                                 | No CRM, Payments, Courses or ledger                                             |

## Part D — Sales (field staff)

| #   | Scenario                      | Steps                                                  | Expected                                                                   |
| --- | ----------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------- |
| F1  | Add an enquiry                | **CRM** → **Add enquiry**                              | Appears in _Active_, owned by you                                          |
| F2  | Work a lead                   | Log activity, schedule a follow-up, move the stage     | Each step recorded with time and owner                                     |
| F3  | Dead lead                     | **Move to dead enquiries**, with a reason              | Moves to _Recently dead_, can be restored, never deleted                   |
| F4  | Only own leads                | Neha versus Rohan                                      | Each sees only their own leads                                             |
| F5  | Hand off a lead               | **Request enrolment review**                           | Appears in Vikram's **Handoffs**                                           |
| F6  | Create a batch                | **Batches** → _Create a batch_ → choose a service type | End date pre-fills from the course length; it can be edited                |
| F7  | Place a student               | **Batches** → **Place students**                       | Moved, with a reason                                                       |
| F8  | Record a payment              | **Payments** → open a student → **Record payment**     | Receipt number `DXR-…`; paid total and balance update                      |
| F9  | Transaction ID rule           | Choose UPI with no transaction ID                      | **Record payment** stays disabled; cash needs no ID                        |
| F10 | Attach a receipt              | Add a photo or PDF while recording                     | **Download receipt** appears for you                                       |
| F11 | Privacy between Sales staff   | Rohan opens a payment Neha recorded                    | Sees the amount and date, but not the transaction ID, collector or receipt |
| F12 | Can't edit or delete payments | Look for edit or delete controls                       | None; corrections are admin-only                                           |
| F13 | Google sign-in list           | **Google sign-in list** → add a student's Google email | _Waiting for first sign-in_, or _Admission fee pending_                    |
| F14 | Can't revoke                  | Same page                                              | No revoke button for Sales                                                 |

## Part E — Enrolment admin (Vikram)

| #   | Scenario                     | Steps                                                                     | Expected                                                       |
| --- | ---------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------- |
| E1  | Approve a handoff            | **Handoffs** → the waiting request (Kiara Shetty) → **Approve enrolment** | New student and enrolment created                              |
| E2  | Return a handoff             | Instead, **Return to Sales**, with a reason                               | Back in the Sales person's CRM                                 |
| E3  | Activation pack              | **Enrolments** → Ishaan Bose → **Issue activation pack**                  | Member ID, link and backup code shown once                     |
| E4  | Allocate leads               | **CRM assignment** → choose a lead → new owner, with a reason             | Lead moves to that Sales person                                |
| E5  | Schedule a class             | **Classes** → choose a course and batch → **Schedule class**              | Students in that batch see it in Class agenda and get an alert |
| E6  | Reschedule or cancel a class | Edit, then **Save rescheduled class**                                     | Students see the change; a cancelled class stays marked        |
| E7  | Close an enrolment           | **Course closeout** → find a student → **Close this enrolment**           | Access ends; their work moves to their private archive         |

## Part F — Admin (your Google account on 5182)

| #   | Scenario                  | Steps                                                      | Expected                                                                 |
| --- | ------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------ |
| D1  | Google sign-in            | `/admin/sign-in` → **Continue with Google**                | Admin portal; no two-step verification prompt                            |
| D2  | Courses                   | **Courses** → add a course with length and fees; edit one  | Saved, with history; a course with open enrolments cannot leave _Active_ |
| D3  | Payment ledger            | **Payment ledger** → search a student or receipt           | Every payment with collector, recorder and receipt                       |
| D4  | Correct a payment         | Open a student → **Correct DXR-…** → `-500` with a reason  | A correction entry appears; the total falls; it can't go below zero      |
| D5  | Agreed fee                | Student → **Agreed fee**                                   | Balance uses the new fee                                                 |
| D6  | Revoke Google sign-in     | **Google sign-in list** → **Revoke**, with a reason        | Status _Revoked_; that Google account can no longer sign in              |
| D7  | Restore                   | Same student → **Restore**                                 | Back to approved                                                         |
| D8  | Switch portals            | **Switch to Sales portal** / Teacher portal                | Same account, different tools                                            |
| D9  | Password admin is limited | On 5183, sign in as Aditi with a password and open Courses | Redirected to the security page: admin pages need Google                 |

---

## Gaps found while writing these (decide before launch)

1. **No progress view for teachers.** A teacher sees only work _waiting_ for review. Reviewed work leaves the queue, and there is no per-student or per-batch progress page: who submitted, who is late, the feedback history. Recommended next feature: a **Batch progress** page in the Teacher portal (students × assignments grid: not started, submitted, reviewed, correction requested, late).
2. **Teachers can't schedule classes.** An earlier decision (D-034) gives this to course-scoped admins (Vikram here). Decide whether teachers should schedule their own batches' classes.
3. **Staff onboarding with Google.** The Employees page still needs authenticator-verified admins and email delivery (DW-055).
4. **Activation pack versus Google-only sign-in.** New students still receive a Member ID activation pack, while sign-in is planned to be Google-only. Decide whether activation is replaced by "add Google email and record admission fee".
