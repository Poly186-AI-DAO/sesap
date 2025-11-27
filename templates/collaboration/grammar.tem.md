# Collaboration Agreement

This Collaboration Agreement ("Agreement") is entered into as of {{effectiveDate as "MMMM DD, YYYY"}} by and between the following parties:

{{#each parties}}
- **{{name}}** (Wallet: {{walletAddress}}) - Role: {{role}}{{#if contributionPercentage}}, Contribution: {{contributionPercentage}}%{{/if}}
{{/each}}

## 1. Project Description

The parties agree to collaborate on the project known as **"{{projectName}}"**.

{{projectDescription}}

## 2. Term

This Agreement shall commence on the Effective Date and{{#if expirationDate}}, unless earlier terminated, shall expire on {{expirationDate as "MMMM DD, YYYY"}}{{else}} shall continue until mutually terminated by the parties{{/if}}.

{{#if milestones}}
## 3. Milestones

The parties agree to the following project milestones:

{{#each milestones}}
- **{{name}}**: {{description}} (Due: {{dueDate as "MMMM DD, YYYY"}})
{{/each}}
{{/if}}

{{#if intellectualPropertyTerms}}
## 4. Intellectual Property

{{intellectualPropertyTerms}}
{{/if}}

{{#if profitSharingTerms}}
## 5. Profit Sharing

{{profitSharingTerms}}
{{/if}}

{{#if governanceRules}}
## 6. Governance

{{governanceRules}}
{{/if}}

{{#if disputeResolution}}
## 7. Dispute Resolution

{{disputeResolution}}
{{/if}}

## 8. Digital Signatures

By signing this Agreement digitally via blockchain wallet signature, each party acknowledges that they have read, understand, and agree to be bound by the terms and conditions set forth herein.

This Agreement constitutes a Smart Social Contract and may be executed and enforced through the SESAP platform.
