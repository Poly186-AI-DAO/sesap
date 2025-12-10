POC / Pilot Engagement Agreement

This Agreement ("Agreement") is made between the parties identified below on the Effective Date provided.

Title: {{title}}

PARTIES

Provider:
{{#clause provider}}
  {{name}} ({{role}})
  {{#ulist contacts}}
    - {{name}}{{#if role}}, {{role}}{{/if}}{{#if notes}} — {{notes}}{{/if}}
  {{/ulist}}
{{/clause}}

{{#if intermediary}}
Intermediary / Referrer:
{{#clause intermediary}}
  {{name}} ({{role}})
  {{#ulist contacts}}
    - {{name}}{{#if role}}, {{role}}{{/if}}{{#if notes}} — {{notes}}{{/if}}
  {{/ulist}}
{{/clause}}
{{/if}}

Client:
{{#clause client}}
  {{name}} ({{role}})
  {{#ulist contacts}}
    - {{name}}{{#if role}}, {{role}}{{/if}}{{#if notes}} — {{notes}}{{/if}}
  {{/ulist}}
{{/clause}}

RECITALS / BACKGROUND

Whereas the Provider offers AI, automation and consulting services; and
Whereas the Client seeks to evaluate AI opportunities, perform a process audit and run one or more POC/pilot implementations to demonstrate value and support executive decision-making; and
Whereas the parties intend to proceed initially with discovery, workshops, and up to two targeted POCs with the potential for later productization or scaled solutions;

Now, therefore, in consideration of the mutual promises contained herein, the parties agree as follows.

1. Scope of Work

1.1 Engagement Types
{{#ulist engagementType}}
- {{.}}
{{/ulist}}

1.2 Deliverables
{{#ulist deliverables}}
- {{.}}
{{/ulist}}

1.3 Phases
{{#clause phases}}
Phase: {{name}}
  Description: {{description}}
  Activities:
  {{#ulist activities}}
  - {{.}}
  {{/ulist}}
  {{#if dependencies}}
  Dependencies:
  {{#ulist dependencies}}
  - {{.}}
  {{/ulist}}
  {{/if}}
  {{#if outputs}}
  Expected Outputs:
  {{#ulist outputs}}
  - {{.}}
  {{/ulist}}
  {{/if}}

{{/clause}}

2. Timeline & Milestones

Start Date: {{startDate}}
Duration: {{duration}}

Milestones
{{#clause milestones}}
- {{name}} — Target: {{targetDate}}{{#if details}}; {{details}}{{/if}}
{{/clause}}

3. Commercial Terms

{{#clause commercialTerms}}
Payment Terms: {{paymentTerms}}

Proposed Fees (for planning purposes):
- Phase 1 & 2 (Discovery & Workshops): ${{proposedPhase12Fee}} fixed fee
- Phase 3 (POC / Pilot): ${{proposedPOCFee}} per POC / pilot
- Optional Phase 4 (Scaled/Productization): ${{proposedHourlyRate}} per hour for design & build (estimates subject to scoping)

Estimated Value: {{estimatedValue}}
ROI Expectation: {{roiExpectation}}
{{/clause}}

Invoices will be issued per the schedule above. Unless otherwise agreed, invoices are due within 30 days of invoice date. Travel and third‑party expenses, if any, will be reimbursed by Client at cost with receipts.

4. Confidentiality

Each party agrees to keep confidential all non‑public information disclosed by the other party in connection with this engagement. Confidential information shall be used only for purposes of performing this Agreement and shall not be disclosed to third parties except as required by law. This confidentiality obligation survives termination of this Agreement for a period of two (2) years.

5. Intellectual Property

Unless otherwise agreed in writing, the Client owns its data and final deliverables specifically prepared for Client under this Agreement. The Provider retains ownership of pre‑existing tools, frameworks, templates, and general know‑how used to deliver services. Provider grants Client a non‑exclusive license to use any Provider tools as part of delivered solutions as described in project documentation.

6. Termination

Either party may terminate this Agreement for convenience with thirty (30) days' prior written notice. Upon termination, Client will pay Provider for all work performed and reasonable expenses incurred to the effective date of termination. Either party may terminate for material breach after providing the other party a reasonable cure period (not to exceed 30 days) if the breach is not cured.

7. Limitation of Liability (brief)

Except for willful misconduct or gross negligence, neither party will be liable to the other for indirect, special, incidental, or consequential damages arising from this Agreement.

8. Next Steps

{{#ulist nextSteps}}
- Owner: {{owner}} — {{action}} (Status: {{status}}){{#if source}}; Source: {{source}}{{/if}}
{{/ulist}}

9. Miscellaneous

This Agreement is governed by the laws of the mutually agreed jurisdiction. Any amendments must be in writing and signed by authorized representatives of both parties.

EXECUTION

By signing below, the parties acknowledge and agree to the terms of this Agreement.

{{#clause signatures}}
Signature: {{signature}}
Name: {{name}}
Role: {{role}}
Date: {{date}}

{{/clause}}
