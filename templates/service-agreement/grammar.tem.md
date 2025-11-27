# Service Agreement

This Service Agreement ("Agreement") is entered into as of {{effectiveDate as "MMMM DD, YYYY"}}.

## Parties

**Service Provider:**
- Name: {{provider.name}}
- Wallet Address: {{provider.walletAddress}}
{{#if provider.email}}- Email: {{provider.email}}{{/if}}
{{#if provider.description}}- Description: {{provider.description}}{{/if}}

**Client:**
- Name: {{client.name}}
- Wallet Address: {{client.walletAddress}}
{{#if client.email}}- Email: {{client.email}}{{/if}}

## 1. Services

The Service Provider agrees to provide the following services to the Client:

**Service Name:** {{serviceName}}

{{serviceDescription}}

## 2. Timeline

- **Effective Date:** {{effectiveDate as "MMMM DD, YYYY"}}
- **Completion Date:** {{completionDate as "MMMM DD, YYYY"}}

## 3. Deliverables and Payment

**Total Contract Value:** {{totalAmount}} {{currency}}

{{#if depositAmount}}
**Deposit Required:** {{depositAmount}} {{currency}}
{{/if}}

**Payment Schedule:** {{paymentSchedule}}

### Deliverables:

{{#each deliverables}}
| {{name}} | {{description}} | Due: {{dueDate as "MMM DD, YYYY"}} | {{amount}} {{currency}} |
{{/each}}

{{#if revisionLimit}}
## 4. Revisions

The Client is entitled to up to {{revisionLimit}} rounds of revisions per deliverable at no additional cost.
{{/if}}

{{#if termsAndConditions}}
## 5. Terms and Conditions

{{termsAndConditions}}
{{/if}}

{{#if cancellationPolicy}}
## 6. Cancellation Policy

{{cancellationPolicy}}
{{/if}}

## 7. Digital Execution

This Agreement is executed as a Smart Social Contract on the SESAP platform. By signing digitally via blockchain wallet signature:

1. The Service Provider agrees to deliver the services as described.
2. The Client agrees to pay the Service Provider according to the payment schedule.
3. Both parties agree to the terms and conditions set forth herein.

Payments may be automated and enforced through smart contract execution upon confirmation of deliverable completion.
