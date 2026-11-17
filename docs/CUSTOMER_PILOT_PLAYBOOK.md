# Customer Pilot Playbook

## Pilot objective

Prove that a named customer can use Calibrex OSINT Studio to monitor a defined risk or market question, identify a developing signal, investigate it, review supporting evidence and produce a useful briefing.

## Before onboarding

1. Identify the customer sponsor, administrator and analysts.
2. Define the monitoring question, geography, languages, entities and reporting cadence.
3. Agree permitted data sources and prohibited use cases.
4. Agree pilot duration, success measures, support channel and escalation contacts.
5. Execute appropriate pilot terms, privacy terms and data-processing terms.
6. Provision a dedicated test/customer environment; do not mix customer data with another customer's data.
7. Confirm retention, export and deletion expectations.

## First session

- Explain source coverage and freshness limitations.
- Configure 3–5 focused watch topics rather than broad noisy keywords.
- Review source health and identify restricted or unmeasured sources.
- Configure one alert rule with a clear threshold and rationale.
- Create a sample investigation and attach public evidence.
- Generate a briefing and inspect every source link.
- Explain the distinction between source claim, corroboration, analyst inference and unknown.

## Acceptance scenarios

| Scenario | Expected result |
|---|---|
| Source becomes unavailable | Last-good data remains visible and source is marked stale/failed |
| Same story is syndicated | Coverage is not misrepresented as multiple independent confirmations |
| Social post contains an allegation | It remains an unverified lead |
| Pattern detector groups posts | Output is an analyst lead, not attribution or proof of coordination |
| AI summarises an article | Claims remain source-linked and analyst-reviewable |
| Market feed is delayed | Delay and last-updated time are visible |
| User loses access | Session and account access are revoked |
| Customer requests export/deletion | Request is logged, scoped and completed under agreed process |

## Success measures

Agree numerical targets with each pilot customer. Suggested measures:
- Time to create a monitoring workspace.
- Time from public source publication to platform collection (measured, not promised).
- Signal-to-noise ratio of alerts reviewed by analysts.
- Percentage of briefing claims with usable source references.
- Analyst time saved per briefing.
- Source freshness and failure rates.
- User activation and weekly active usage.

## Exit

At pilot end, review success measures, unresolved defects, customer feedback, support effort and unit economics. Convert to a paid annual agreement only when the promised deployment model and data controls are actually available.
