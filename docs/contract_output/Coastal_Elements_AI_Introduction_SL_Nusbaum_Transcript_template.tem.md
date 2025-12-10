# Proof of Concept / Pilot Engagement Agreement

{{contractTitle}}

This Proof of Concept / Pilot Engagement Agreement ("Agreement") is made between the parties identified below.

RECITALS

Whereas, the parties set forth their mutual understanding and agree to the terms in this Agreement.

Provider: {{#if parties.provider.contactsDisplay.[0]}}{{parties.provider.contactsDisplay.[0]}}{{else}}{{parties.provider.name}} ({{parties.provider.role}}){{/if}}

Client: {{#if parties.client}}{{parties.client.name}} ({{parties.client.role}}){{/if}}

Intermediary: {{#if parties.intermediary}}{{parties.intermediary.name}} ({{parties.intermediary.role}}){{/if}}

Background

- {{parties.provider.name}} brings expertise in AI strategy, architecture, and Azure‑native implementations, and will act as the Provider for this engagement.
- {{parties.client.name}} seeks to evaluate, prioritize, and (potentially) deploy AI solutions to improve internal processes and to create marketable, client‑facing offerings.
- The parties wish to proceed with an exploratory engagement that includes discovery, prioritization, POC design, and — if approved — POC implementation in the Client’s Azure environment.

AGREEMENT

1. Scope of Work

{{#clause scopeOfWork}}
Deliverables include:
{{#ulist deliverables}}
- {{.}}
{{/ulist}}

Phases and approach (summary):
{{#ulist phaseSummaries}}
- {{.}}
{{/ulist}}

Detailed phase descriptions and activities will be provided in separate phase deliverables and workshop artifacts.
{{/clause}}

2. Timeline and Milestones

The parties agree to proceed with an exploratory phase through mid‑January 2026, with POC and implementation timelines to be determined after discovery.

Key milestones:
{{#clause timeline}}
{{#ulist milestonesSummaries}}
- {{.}}
{{/ulist}}
{{/clause}}

Specific milestone dates will be set by mutual agreement as discovery outputs are delivered.

3. Commercial Terms and Payment

{{#clause commercialTerms}}{{/clause}}

Payment summary (example and agreed schedule):
{{#clause commercialTerms}}
- Phase 1 (Discovery & Workshops): $20,000 payable 50% on signing of this Agreement and 50% on delivery of the Phase 1 report (AI readiness and discovery outputs).
- Phase 2 (Use Case Prioritization & POC Design): $12,000 payable 50% on project start for Phase 2 and 50% on delivery of the POC design package.
- Phase 3 (POC Build & Deployment): Budgetary estimate to be provided following Phase 2; POC work will be billed on a time and materials basis or as a fixed fee per POC as agreed in a separate statement of work.
- All travel and out‑of‑pocket expenses, if any, will be reimbursed by Client at cost, subject to prior approval where required.

Invoices are payable within 30 days of receipt. Late payments may accrue interest at 1.5% per month or the maximum permitted by law.
{{/clause}}

4. Confidentiality

Each party agrees that Confidential Information disclosed by the other party will be used solely for the purposes of this engagement and will not be disclosed to third parties except to those employees, contractors or advisors who need to know and who are bound by obligations of confidentiality no less restrictive than those in this Agreement. Confidential Information does not include information that is publicly known through no breach of this Agreement, already known without obligation of confidentiality, or independently developed.

5. Term and Termination

This Agreement begins upon signature and covers the work described in Section 1. Either party may terminate this Agreement for convenience with 30 days' written notice. Either party may also terminate for cause if the other party materially breaches this Agreement and fails to remedy the breach within 15 days of written notice. On termination, Provider will invoice Client for all work performed and reasonable wind‑down costs; Client will pay undisputed amounts within 30 days.

6. Intellectual Property and Deployment

Unless otherwise agreed in writing, work product created specifically for the Client under this Agreement will be owned by the Client upon full payment; Provider retains ownership of its pre‑existing tools, frameworks, and proprietary SaaS components. If a POC uses Provider’s existing SaaS, licensing or integration terms will be set out in a separate addendum.

7. Limitation of Liability

Except for liability arising from willful misconduct or gross negligence, each party’s liability is limited to direct damages up to the amount paid by Client to Provider under this Agreement in the prior twelve (12) months. Neither party is liable for consequential, incidental, special or punitive damages.

8. Miscellaneous

Governing law: The laws of the Commonwealth of Virginia (or other mutually agreed jurisdiction) govern this Agreement. This Agreement constitutes the entire agreement between the parties related to its subject matter and supersedes prior discussions.

Notices: All notices required or permitted under this Agreement shall be in writing and delivered to the contact details provided by each party, by personal delivery, nationally recognized overnight courier, certified mail (postage prepaid, return receipt requested), or email when receipt is acknowledged.

Force Majeure: Neither party will be liable for delays or failures in performance caused by events beyond its reasonable control, including acts of God, pandemics, strikes, governmental actions, or infrastructure outages. The affected party shall notify the other promptly and use reasonable efforts to resume performance.

Assignment: Neither party may assign this Agreement without the prior written consent of the other party, except to a successor in interest in connection with a merger, acquisition or sale of substantially all assets, provided the successor assumes all obligations hereunder.

Independent Contractors: The parties are independent contractors. Nothing in this Agreement creates a partnership, joint venture, agency, or employment relationship between the parties.

Severability: If any provision of this Agreement is held invalid or unenforceable, the remaining provisions will remain in full force and effect.

Amendment and Waiver: This Agreement may be amended only by a writing signed by both parties. No waiver of any provision is effective unless in writing and signed by the waiving party.

Counterparts: This Agreement may be executed in counterparts, each of which is deemed an original and all of which together constitute one instrument. Electronic signatures are permitted.

9. Next Steps

Planned immediate actions:
{{#ulist nextStepsSummaries}}
- {{.}}
{{/ulist}}

10. Acceptance and Signatures

By signing below, the parties acknowledge and accept the terms of this Engagement Agreement.

Provider:

Signature: ____________________________

Name: {{signatures.[0].signerName}}

Title: {{signatures.[0].role}}

Date: {{signatures.[0].date}}

Client:

Signature: ____________________________

Name: {{signatures.[1].signerName}}

Title: {{signatures.[1].role}}

Date: {{signatures.[1].date}}
