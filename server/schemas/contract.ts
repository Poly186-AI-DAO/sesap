/**
 * Zod Schemas for Contract Generation
 * 
 * Type-safe schemas for LLM structured output
 * 
 * IMPORTANT: OpenAI Structured Output requires ALL fields to be required.
 * Use .nullable() instead of .optional() for optional fields.
 * See: https://platform.openai.com/docs/guides/structured-outputs#all-fields-must-be-required
 */

import { z } from 'zod';

// ==================== CONTACT & PARTY ====================

export const ContactSchema = z.object({
  name: z.string().describe('Full name of the contact'),
  role: z.string().describe('Role or title of the contact'),
  notes: z.string().nullable().describe('Additional notes about this contact, or null if none'),
});

export const PartySchema = z.object({
  name: z.string().describe('Name of the organization or entity'),
  role: z.string().describe('Role in the contract (e.g., Provider, Client, Intermediary)'),
  contacts: z.array(ContactSchema).describe('Key contacts at this party, empty array if none'),
});

// ==================== SCOPE OF WORK ====================

export const PhaseSchema = z.object({
  name: z.string().describe('Name of the phase (e.g., Phase 1 - Discovery)'),
  description: z.string().nullable().describe('Description of what this phase accomplishes, or null'),
  activities: z.array(z.string()).describe('Specific activities in this phase, empty array if none'),
  dependencies: z.array(z.string()).describe('Dependencies or prerequisites, empty array if none'),
  outputs: z.array(z.string()).describe('Expected deliverables from this phase, empty array if none'),
});

export const ScopeOfWorkSchema = z.object({
  deliverables: z.array(z.string()).describe('List of key deliverables'),
  phases: z.array(PhaseSchema).describe('Phases of the engagement, empty array if none'),
});

// ==================== TIMELINE ====================

export const MilestoneSchema = z.object({
  name: z.string().describe('Name of the milestone'),
  targetDate: z.string().nullable().describe('Target date or timeframe, or null if not specified'),
  details: z.string().nullable().describe('Additional details about this milestone, or null'),
});

export const TimelineSchema = z.object({
  startDate: z.string().nullable().describe('Start date of the engagement, or null if not specified'),
  duration: z.string().describe('Expected duration (e.g., 6 months)'),
  milestones: z.array(MilestoneSchema).describe('Key milestones, empty array if none'),
});

// ==================== COMMERCIAL TERMS ====================

export const CommercialTermsSchema = z.object({
  paymentTerms: z.string().nullable().describe('Payment terms (e.g., Net 30, 50% upfront), or null'),
  estimatedValue: z.string().nullable().describe('Estimated contract value, or null if not discussed'),
  roiExpectation: z.string().nullable().describe('Expected ROI or value proposition, or null'),
});

// ==================== NEXT STEPS ====================

export const NextStepSchema = z.object({
  owner: z.string().describe('Person or party responsible'),
  action: z.string().describe('Action to be taken'),
  status: z.string().nullable().describe('Status (e.g., Planned, In Progress, Complete), or null'),
  source: z.string().nullable().describe('Source quote or reference, or null'),
});

// ==================== MAIN CONTRACT STRUCTURE ====================

export const ContractStructureSchema = z.object({
  parties: z.object({
    provider: PartySchema.describe('The party providing services'),
    intermediary: PartySchema.nullable().describe('Optional intermediary or referrer, or null if none'),
    client: PartySchema.describe('The party receiving services'),
  }),
  engagementType: z.array(z.string()).describe('Types of engagement (e.g., Audit, POC, Consulting)'),
  scopeOfWork: ScopeOfWorkSchema.describe('Scope of work including deliverables and phases'),
  timeline: TimelineSchema.describe('Timeline including start date and milestones'),
  commercialTerms: CommercialTermsSchema.describe('Commercial and payment terms'),
  nextSteps: z.array(NextStepSchema).describe('Action items and next steps'),
  keyQuotes: z.array(z.string()).describe('2-3 important quotes from the meeting'),
});

// ==================== ACCORD ARTIFACTS ====================
// Note: jsonData is a string containing JSON because OpenAI structured output
// doesn't support z.record() (generates unsupported 'propertyNames' in schema).
// Parse the JSON string after receiving the response.

export const AccordArtifactsSchema = z.object({
  concertoModel: z.string().describe('Full Concerto model (.cto content)'),
  templateMark: z.string().describe('Full TemplateMark template (.tem.md content)'),
  jsonData: z.string().describe('Populated JSON data for the contract as a JSON string'),
});

// ==================== VALIDATION RESULT ====================

export const ValidationResultSchema = z.object({
  isValid: z.boolean().describe('Whether the artifacts are valid'),
  issues: z.array(z.string()).describe('List of issues found, empty array if none'),
  fixes: z.array(z.string()).describe('List of fixes applied, empty array if none'),
  concertoModel: z.string().describe('Validated/fixed Concerto model'),
  templateMark: z.string().describe('Validated/fixed TemplateMark template'),
  jsonData: z.string().describe('Validated/fixed JSON data as a JSON string'),
});

// ==================== TYPE EXPORTS ====================

export type Contact = z.infer<typeof ContactSchema>;
export type Party = z.infer<typeof PartySchema>;
export type Phase = z.infer<typeof PhaseSchema>;
export type ScopeOfWork = z.infer<typeof ScopeOfWorkSchema>;
export type Milestone = z.infer<typeof MilestoneSchema>;
export type Timeline = z.infer<typeof TimelineSchema>;
export type CommercialTerms = z.infer<typeof CommercialTermsSchema>;
export type NextStep = z.infer<typeof NextStepSchema>;
export type ContractStructure = z.infer<typeof ContractStructureSchema>;
export type AccordArtifacts = z.infer<typeof AccordArtifactsSchema>;
export type ValidationResult = z.infer<typeof ValidationResultSchema>;

