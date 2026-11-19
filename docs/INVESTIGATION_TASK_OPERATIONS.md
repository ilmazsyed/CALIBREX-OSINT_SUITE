# Investigation task operations

Investigation tasks support:
- Required task title and bounded description / expected output.
- Owner user ID, priority, status and due date.
- Dependencies on other task IDs.
- Dependency reference, self-dependency, duplicate ID, missing title, due-date and cycle validation.
- Summary counts for open, in-progress, blocked, done, overdue and due within 48 hours.
- A bounded 200-event task change history recording additions, updates, removals, actor, role, timestamp and changed fields.

Task state is operational tracking only. Marking a task done does not approve an investigation, validate a source or change an evidence assessment. Reviewer-only investigation approval remains a separate workflow transition.
