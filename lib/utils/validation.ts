/**
 * Zod Validation Schemas for SESAP
 */

import { z } from "zod";

// Party schema
export const partySchema = z.object({
  walletAddress: z.string().min(1, "Wallet address is required"),
  name: z.string().min(1, "Name is required"),
  email: z.string().email().optional().or(z.literal("")),
  role: z.string().min(1, "Role is required"),
});

export type PartyInput = z.infer<typeof partySchema>;

// Create agreement schema
export const createAgreementSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  description: z.string().optional(),
  templateId: z.string().optional(),
  templateData: z.record(z.string(), z.unknown()).optional(),
  parties: z.array(partySchema).min(1, "At least one party is required"),
  effectiveDate: z.string().datetime().optional(),
  expirationDate: z.string().datetime().optional(),
});

export type CreateAgreementInput = z.infer<typeof createAgreementSchema>;

// Update agreement schema
export const updateAgreementSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  templateData: z.record(z.string(), z.unknown()).optional(),
  contractText: z.string().optional(),
  status: z
    .enum([
      "DRAFT",
      "PENDING_SIGNATURES",
      "ACTIVE",
      "EXECUTED",
      "EXPIRED",
      "CANCELLED",
    ])
    .optional(),
  effectiveDate: z.string().datetime().optional(),
  expirationDate: z.string().datetime().optional(),
});

export type UpdateAgreementInput = z.infer<typeof updateAgreementSchema>;

// Sign agreement schema
export const signAgreementSchema = z.object({
  signature: z.string().min(1, "Signature is required"),
  message: z.string().min(1, "Message is required"),
});

export type SignAgreementInput = z.infer<typeof signAgreementSchema>;

// Generate agreement schema (for AI)
export const generateAgreementSchema = z.object({
  type: z.enum(["collaboration", "service", "investment", "custom"]),
  description: z.string().min(10, "Please provide a detailed description"),
  parties: z
    .array(
      z.object({
        name: z.string().min(1),
        role: z.string().min(1),
      })
    )
    .min(1),
  terms: z.record(z.string(), z.unknown()).optional(),
});

export type GenerateAgreementInput = z.infer<typeof generateAgreementSchema>;

// User schema
export const userSchema = z.object({
  walletAddress: z.string().min(1),
  email: z.string().email().optional(),
  name: z.string().optional(),
  avatar: z.string().url().optional(),
});

export type UserInput = z.infer<typeof userSchema>;

// Template variable schema
export const templateVariableSchema = z.object({
  templateId: z.string().min(1),
  variables: z.record(z.string(), z.unknown()),
});

export type TemplateVariableInput = z.infer<typeof templateVariableSchema>;

// Pagination schema
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

// Agreement status enum
export const AgreementStatus = {
  DRAFT: "DRAFT",
  PENDING_SIGNATURES: "PENDING_SIGNATURES",
  ACTIVE: "ACTIVE",
  EXECUTED: "EXECUTED",
  EXPIRED: "EXPIRED",
  CANCELLED: "CANCELLED",
} as const;

export type AgreementStatusType =
  (typeof AgreementStatus)[keyof typeof AgreementStatus];

/**
 * Validate and parse input data
 */
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return { success: false, errors: result.error };
}

/**
 * Format Zod errors for API response
 */
export function formatZodErrors(error: z.ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.join(".");
    if (!formatted[path]) {
      formatted[path] = [];
    }
    formatted[path].push(issue.message);
  }

  return formatted;
}
