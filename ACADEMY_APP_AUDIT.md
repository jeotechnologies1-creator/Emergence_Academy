# Emergence Academy Product Audit

## Executive assessment

Emergence Academy has a credible school-operations base: authenticated role-specific access, student and parent records, attendance, assignments, grades, finance, notifications, reports, AI support, and Agora live classes are already implemented. The priority is not to add unrelated screens. It is to join these capabilities into dependable learning journeys for students, teachers, guardians, and school operators.

Current market references converge on the same essentials. Google Classroom centers assignment status, direct feedback, grades, guardian summaries, class communication, and video meetings.[^1] Canvas provides students and observers with course navigation, calendar, inbox, assignments, grades, and a clear read-only guardian model.[^2][^3] Moodle’s current student feature matrix similarly includes course calendars, reminders, messages, notifications, and gradebooks.[^4]

## Current capability map

| Area | Present in Emergence Academy | Audit result |
| --- | --- | --- |
| Role-aware portal | CEO, admin, executive, teacher, student, parent, finance, HR, admission, exam, and library roles | Strong foundation |
| Student information | Admission, class, department, guardian, subject, address, and profile data | Present; needs a single student timeline |
| Teaching and assessment | Teacher-created assignments, questions, image submissions, deadlines, student submissions | Present; needs submission states, feedback, marking, rubrics, and return workflow |
| Grades and attendance | Grade records, parent performance view, attendance records and live-class attendance | Present; needs class gradebook, term report workflow, and clear summaries |
| Communication | In-app notifications and live-class notifications | Needs announcements, conversations, delivery preferences, and escalation paths |
| Parent experience | Linked-child performance and payment view | Present; needs a protected guardian summary and missing/upcoming-work view |
| Live learning | Scheduled Agora sessions, approved rosters, attendance on join, secure token routes | Present; requires deployment health checks and session lifecycle monitoring |
| Payments | Payment plans, receipt upload, reconciliation views | Present; needs receipt state history, payment reminders, and downloadable receipts |
| Accessibility and responsive UI | Responsive layouts, scroll-safe forms and dialogs, semantic labels in many controls | Improving; needs keyboard flow, focus management, status announcements, and contrast review |
| Operations | Reports, profiles, permissions, audit-log table references | Needs operational dashboard, exports, archival policy, and incident/runbook documentation |

## Highest-priority product gaps

### 1. A course home instead of disconnected modules

Students currently navigate subjects, assignments, grades, attendance, notifications, and live classes as separate dashboard modules. Standard LMS products organize these around a course/class home with upcoming work, learning materials, announcements, activity completion, roster information, and a calendar. This is the highest-impact experience improvement because it makes the existing data discoverable.

Implement a course home per class/subject with:

- upcoming and overdue assignments;
- next live class and join state;
- latest announcement;
- latest feedback and grade;
- attendance percentage;
- teacher-provided resources;
- a clear parent read-only version for linked children.

### 2. Assessment completion and feedback loop

The app supports assignment creation and submission but lacks the standard marking lifecycle: `assigned → submitted → returned → graded`, private feedback, score, late status, resubmission history, and teacher review queue. Google Classroom explicitly exposes these states and supports feedback and teacher review in one place.[^5]

Implement a normalized submission status, score, feedback, graded/returned timestamps, and a teacher “To review” queue. Add a simple rubric only after the base feedback workflow is proven in use.

### 3. Calendar, reminders, and term awareness

There is no unified calendar although the application has dated assignments, payments, attendance, and live sessions. Mature LMS products expose course events and upcoming deadlines in the primary navigation.[^2][^4]

Implement a read-only first release that merges assignments, live classes, payment deadlines, and school events. Add notification reminders (for example, seven days and one day before a due date) as a second release; reminders must respect user preferences and time zone.

### 4. Guardian-safe summaries

Parents can view linked-child data, but they need an at-a-glance summary of upcoming work, missing work, feedback, attendance, upcoming payments, and school notices. Guardian access must remain read-only and tied strictly to linked children. Google Classroom’s guardian model provides summaries while retaining explicit privacy boundaries.[^6]

Implement a parent digest page first. Email or WhatsApp delivery should only be added after explicit consent, unsubscribe controls, and delivery monitoring are in place.

### 5. Communication model

Notifications are not a replacement for conversations. Provide announcements (school/class/subject scoped) before direct messaging. Announcements are lower risk, easier to moderate, and solve most teacher-to-class communication. Then introduce teacher-parent and teacher-student conversations with role-aware recipient rules, reporting/blocking, retention policy, and audit logging.

### 6. Reliability and operational readiness

The app relies on Supabase Edge Functions for privileged workflows, especially account provisioning and Agora. Each production function needs a deployment checklist, environment-secret checklist, monitoring, error correlation ID, and a human-readable error response. The Agora issue identified in this audit is a good example: a channel-name mismatch was previously presented as a generic Edge Function error.

Add a protected admin “System health” page that checks configuration readiness without exposing secrets: database connection, required storage buckets, required Edge Function reachability, current term, and configured notification channels.

## Recommended delivery plan

| Phase | Outcome | Main changes | Success measure |
| --- | --- | --- | --- |
| 0 — Stabilize | Trustworthy production baseline | Deployment checklist, migration ledger, Edge Function error handling, backup/restore process, mobile/accessibility verification | No generic function errors; support can identify failed component and remedy |
| 1 — Learning flow | Students and teachers can complete a full assignment cycle | Teacher review queue, feedback, score, returned state, missing/late status, student feedback view | Every submitted assignment can be reviewed and returned |
| 2 — Class hub | One home for each class/subject | Course home, resources, announcements, upcoming work, attendance and grade summaries | Students find next action in one screen |
| 3 — Calendar and guardian summary | Predictable planning and parent visibility | Unified calendar, deadline reminders, protected parent digest | Fewer missed assignments and fewer parent support requests |
| 4 — Operations | Staff can run the school confidently | Exports, audit events, health view, data-retention controls, support runbook | Office teams resolve routine issues without database access |
| 5 — Advanced learning | Extend only after core use is stable | Rubrics, quizzes, resource completion, discussions, certificates, analytics | Adoption and completion improve without raising operational burden |

## Security, privacy, and resilience requirements

- Apply every migration in order and record the deployed migration version.
- Deploy and version every Edge Function used by the browser; configure secrets only in Supabase, never browser code.
- Enforce row-level security for every student, guardian, submission, payment receipt, and message record. Browser-side role hiding is never authorization.
- Log privileged actions: account creation/reset, grade edits, attendance edits, payment-status changes, guardian links, and live-class scheduling.
- Store uploads in private buckets and issue short-lived signed URLs only after authorization.
- Define retention and deletion policies for student records, submissions, receipts, attendance, and messages before adding direct messaging.
- Add a backup/restore drill and an incident contact path before depending on the app for term records.
- Provide accessible keyboard navigation, visible focus, error summaries, form labels, status announcements, and text alternatives for meaningful images. Follow WCAG 2.2 AA as the target standard.[^7]

## What should not be added yet

- Public student-to-student chat or social features.
- Automated grading or AI decisions that change academic records without teacher review.
- WhatsApp/SMS delivery without consent, cost controls, opt-out handling, and audit trails.
- A native app before the web application has a stable mobile course home and offline strategy.
- Broad “admin can see everything” queries that weaken least-privilege data rules.

## Product acceptance criteria

The next release should not be considered complete until:

1. A student can find all due work and the next live class in under two interactions.
2. A teacher can see all submissions needing review, give feedback, and return a grade.
3. A parent sees only linked-child data, including upcoming/missing work and payment state.
4. Every mobile form, table, dialog, and live-class control remains reachable with keyboard and scrolling.
5. A failed Edge Function operation presents the server’s actionable message and a support reference.
6. No privileged workflow relies solely on client-side role checks.

## Sources

[^1]: Google, [About Classroom](https://support.google.com/edu/classroom/answer/6020279?hl=en), accessed September 10, 2026.
[^2]: Instructure, [Canvas LMS Student Guide](https://community.instructure.com/en/kb/canvas-lms-student-guide), accessed September 10, 2026.
[^3]: Instructure, [Canvas LMS Observer Guide](https://community.instructure.com/en/kb/canvas-lms-observer-guide), accessed September 10, 2026.
[^4]: Moodle, [Moodle features for students](https://docs.moodle.org/405/en/images_en/2/2a/Moodle_features_students.pdf), accessed September 10, 2026.
[^5]: Google, [Grade, assess & provide feedback](https://support.google.com/edu/classroom/answer/16643267?hl=en), accessed September 10, 2026.
[^6]: Google, [Guardian email summaries & preview FAQ](https://support.google.com/edu/classroom/answer/7126518?hl=en), accessed September 10, 2026.
[^7]: W3C, [Web Content Accessibility Guidelines (WCAG) 2.2](https://www.w3.org/TR/WCAG22/), October 2023.
