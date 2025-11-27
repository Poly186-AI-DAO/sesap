/**
 * Concerto Model Validation
 * Simplified validation layer using Concerto for data structure validation
 * Used to validate AI-generated contract data against expected schemas
 */

import {
  ModelManager,
  Factory,
  Serializer,
} from "@accordproject/concerto-core";

// Base models that all contracts inherit from
const BASE_MODEL = `
namespace org.sesap.base@1.0.0

concept Party {
  o String name
  o String walletAddress regex=/^0x[a-fA-F0-9]{40}$/
  o String email optional
  o String role
}

concept Agreement {
  o String title
  o String description optional
  o DateTime effectiveDate
  o DateTime expirationDate optional
  o Party[] parties
}
`;

// Collaboration agreement model
const COLLABORATION_MODEL = `
namespace org.sesap.collaboration@1.0.0

import org.sesap.base@1.0.0.{Party, Agreement}

concept Milestone {
  o String name
  o String description
  o DateTime dueDate
  o Boolean completed default=false
}

concept CollaborationAgreement extends Agreement {
  o String projectName
  o String projectDescription
  o Double[] contributionPercentages optional
  o Milestone[] milestones optional
  o String governanceRules optional
  o String intellectualPropertyTerms optional
  o String profitSharingTerms optional
  o String disputeResolution optional
}
`;

// Service agreement model
const SERVICE_MODEL = `
namespace org.sesap.service@1.0.0

import org.sesap.base@1.0.0.{Party, Agreement}

enum PaymentSchedule {
  o UPFRONT
  o MILESTONE
  o COMPLETION
  o MONTHLY
}

concept Deliverable {
  o String name
  o String description
  o DateTime dueDate
  o Double amount
  o String currency default="USD"
  o Boolean delivered default=false
  o Boolean paid default=false
}

concept ServiceAgreement extends Agreement {
  o String serviceName
  o String serviceDescription
  o Party provider
  o Party client
  o DateTime completionDate
  o Deliverable[] deliverables
  o PaymentSchedule paymentSchedule
  o Double totalAmount
  o String currency default="USD"
  o Double depositAmount optional
  o String termsAndConditions optional
  o String cancellationPolicy optional
  o Integer revisionLimit optional
}
`;

// Investment/SAFT agreement model
const INVESTMENT_MODEL = `
namespace org.sesap.investment@1.0.0

import org.sesap.base@1.0.0.{Party, Agreement}

enum InvestmentType {
  o EQUITY
  o SAFT
  o SAFE
  o CONVERTIBLE_NOTE
  o REVENUE_SHARE
}

concept InvestmentAgreement extends Agreement {
  o Party investor
  o Party company
  o InvestmentType investmentType
  o Double investmentAmount
  o String currency default="USD"
  o Double equityPercentage optional
  o Double valuationCap optional
  o Double discountRate optional
  o String vestingSchedule optional
  o String conversionTerms optional
  o String investorRights optional
}
`;

// Custom/freeform agreement model
const CUSTOM_MODEL = `
namespace org.sesap.custom@1.0.0

import org.sesap.base@1.0.0.{Party, Agreement}

concept CustomClause {
  o String title
  o String content
  o Integer order default=0
}

concept CustomAgreement extends Agreement {
  o String agreementType
  o CustomClause[] clauses
  o String additionalTerms optional
}
`;

export type AgreementType =
  | "collaboration"
  | "service"
  | "investment"
  | "custom";

/**
 * Get the Concerto model for a specific agreement type
 */
export function getModelForType(type: AgreementType): string {
  const models: Record<AgreementType, string> = {
    collaboration: COLLABORATION_MODEL,
    service: SERVICE_MODEL,
    investment: INVESTMENT_MODEL,
    custom: CUSTOM_MODEL,
  };
  return BASE_MODEL + "\n" + models[type];
}

/**
 * Get the fully qualified class name for an agreement type
 */
export function getClassNameForType(type: AgreementType): string {
  const classNames: Record<AgreementType, string> = {
    collaboration: "org.sesap.collaboration@1.0.0.CollaborationAgreement",
    service: "org.sesap.service@1.0.0.ServiceAgreement",
    investment: "org.sesap.investment@1.0.0.InvestmentAgreement",
    custom: "org.sesap.custom@1.0.0.CustomAgreement",
  };
  return classNames[type];
}

/**
 * Create a ModelManager with the appropriate models loaded
 */
export function createModelManager(type: AgreementType): ModelManager {
  const modelManager = new ModelManager();

  // Add base model first
  modelManager.addCTOModel(BASE_MODEL, "base.cto");

  // Add the specific model
  const typeModels: Record<AgreementType, { content: string; name: string }> = {
    collaboration: { content: COLLABORATION_MODEL, name: "collaboration.cto" },
    service: { content: SERVICE_MODEL, name: "service.cto" },
    investment: { content: INVESTMENT_MODEL, name: "investment.cto" },
    custom: { content: CUSTOM_MODEL, name: "custom.cto" },
  };

  modelManager.addCTOModel(typeModels[type].content, typeModels[type].name);

  return modelManager;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  data?: Record<string, unknown>;
}

/**
 * Validate agreement data against the Concerto model
 */
export function validateAgreementData(
  type: AgreementType,
  data: Record<string, unknown>
): ValidationResult {
  try {
    const modelManager = createModelManager(type);
    const factory = new Factory(modelManager);
    const serializer = new Serializer(factory, modelManager);

    // Add the $class property if not present
    const className = getClassNameForType(type);
    const dataWithClass = {
      $class: className,
      ...data,
    };

    // Try to deserialize - this validates the data
    const resource = serializer.fromJSON(dataWithClass);

    // Serialize back to get normalized data
    const normalizedData = serializer.toJSON(resource);

    return {
      valid: true,
      errors: [],
      data: normalizedData as Record<string, unknown>,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Validation failed";
    return {
      valid: false,
      errors: [message],
    };
  }
}

/**
 * Validate a single field value against expected type
 */
export function validateField(
  value: unknown,
  expectedType: string
): { valid: boolean; error?: string } {
  switch (expectedType) {
    case "String":
      if (typeof value !== "string") {
        return { valid: false, error: "Expected string value" };
      }
      break;
    case "Double":
    case "Integer":
    case "Long":
      if (typeof value !== "number") {
        return { valid: false, error: "Expected number value" };
      }
      break;
    case "Boolean":
      if (typeof value !== "boolean") {
        return { valid: false, error: "Expected boolean value" };
      }
      break;
    case "DateTime":
      if (!(value instanceof Date) && typeof value !== "string") {
        return { valid: false, error: "Expected date value" };
      }
      // Try to parse the date
      const date = new Date(value as string);
      if (isNaN(date.getTime())) {
        return { valid: false, error: "Invalid date format" };
      }
      break;
  }
  return { valid: true };
}

/**
 * Validate wallet address format (Ethereum-style)
 */
export function validateWalletAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Get a list of required fields for an agreement type
 */
export function getRequiredFields(type: AgreementType): string[] {
  const baseFields = ["title", "effectiveDate", "parties"];

  const typeSpecificFields: Record<AgreementType, string[]> = {
    collaboration: ["projectName", "projectDescription"],
    service: [
      "serviceName",
      "serviceDescription",
      "provider",
      "client",
      "completionDate",
      "deliverables",
      "paymentSchedule",
      "totalAmount",
    ],
    investment: ["investor", "company", "investmentType", "investmentAmount"],
    custom: ["agreementType", "clauses"],
  };

  return [...baseFields, ...typeSpecificFields[type]];
}

/**
 * Generate sample data structure for an agreement type
 */
export function getSampleData(type: AgreementType): Record<string, unknown> {
  const baseData = {
    title: "Sample Agreement",
    description: "A sample agreement description",
    effectiveDate: new Date().toISOString(),
    parties: [
      {
        name: "Party A",
        walletAddress: "0x0000000000000000000000000000000000000001",
        role: "Creator",
      },
    ],
  };

  const typeSpecificData: Record<AgreementType, Record<string, unknown>> = {
    collaboration: {
      ...baseData,
      projectName: "Sample Project",
      projectDescription: "A collaborative project between parties",
      milestones: [],
    },
    service: {
      ...baseData,
      serviceName: "Sample Service",
      serviceDescription: "Description of services to be provided",
      provider: {
        name: "Service Provider",
        walletAddress: "0x0000000000000000000000000000000000000001",
        role: "Provider",
      },
      client: {
        name: "Client",
        walletAddress: "0x0000000000000000000000000000000000000002",
        role: "Client",
      },
      completionDate: new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ).toISOString(),
      deliverables: [],
      paymentSchedule: "MILESTONE",
      totalAmount: 1000,
      currency: "USD",
    },
    investment: {
      ...baseData,
      investor: {
        name: "Investor",
        walletAddress: "0x0000000000000000000000000000000000000001",
        role: "Investor",
      },
      company: {
        name: "Company",
        walletAddress: "0x0000000000000000000000000000000000000002",
        role: "Company",
      },
      investmentType: "SAFE",
      investmentAmount: 50000,
      currency: "USD",
    },
    custom: {
      ...baseData,
      agreementType: "Custom",
      clauses: [
        {
          title: "General Terms",
          content: "The parties agree to the following terms...",
          order: 1,
        },
      ],
    },
  };

  return typeSpecificData[type];
}
