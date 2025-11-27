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

// Non-Disclosure Agreement (NDA) model
const NDA_MODEL = `
namespace org.sesap.nda@1.0.0

import org.sesap.base@1.0.0.{Party, Agreement}

enum NDAType {
  o UNILATERAL
  o BILATERAL
  o MULTILATERAL
}

enum ConfidentialityLevel {
  o CONFIDENTIAL
  o HIGHLY_CONFIDENTIAL
  o TOP_SECRET
}

concept ConfidentialInformation {
  o String category
  o String description
  o ConfidentialityLevel level default="CONFIDENTIAL"
}

concept NDAgreement extends Agreement {
  o NDAType ndaType default="BILATERAL"
  o Party disclosingParty
  o Party receivingParty
  o ConfidentialInformation[] confidentialInfo optional
  o String purposeOfDisclosure
  o Integer confidentialityPeriodMonths default=24
  o String[] excludedInformation optional
  o String returnOrDestroyTerms optional
  o String breachRemedies optional
  o String governingLaw optional
  o String jurisdictionVenue optional
}
`;

// Non-Compete Agreement (NCA) model
const NCA_MODEL = `
namespace org.sesap.nca@1.0.0

import org.sesap.base@1.0.0.{Party, Agreement}

concept GeographicScope {
  o String region
  o String description optional
}

concept RestrictedActivity {
  o String activity
  o String description optional
}

concept NCAgreement extends Agreement {
  o Party employer
  o Party employee
  o RestrictedActivity[] restrictedActivities
  o GeographicScope[] geographicScope
  o Integer nonCompetePeriodMonths default=12
  o Double compensationAmount optional
  o String currency default="USD"
  o String[] competitors optional
  o String considerationProvided
  o String enforceabilityClause optional
  o String governingLaw optional
}
`;

// Terms of Service (ToS) model
const TOS_MODEL = `
namespace org.sesap.tos@1.0.0

import org.sesap.base@1.0.0.{Party, Agreement}

concept ServiceTerm {
  o String title
  o String content
  o Integer order default=0
  o Boolean required default=true
}

concept TOSAgreement extends Agreement {
  o String serviceName
  o String serviceDescription
  o Party serviceProvider
  o ServiceTerm[] terms
  o String[] acceptableUsePolicies optional
  o String[] prohibitedActivities optional
  o String limitationOfLiability optional
  o String indemnificationClause optional
  o String terminationConditions optional
  o String modificationRights optional
  o String disputeResolution optional
  o String governingLaw optional
  o String privacyPolicyReference optional
  o String contactInformation optional
}
`;

// Constitution model (for DAOs, organizations, communities)
const CONSTITUTION_MODEL = `
namespace org.sesap.constitution@1.0.0

import org.sesap.base@1.0.0.{Party, Agreement}

enum VotingMechanism {
  o SIMPLE_MAJORITY
  o SUPER_MAJORITY
  o UNANIMOUS
  o QUADRATIC
  o TOKEN_WEIGHTED
}

concept Article {
  o Integer articleNumber
  o String title
  o String content
  o String[] sections optional
}

concept Amendment {
  o Integer amendmentNumber
  o String title
  o String content
  o DateTime ratifiedDate optional
  o VotingMechanism requiredVotingMechanism default="SUPER_MAJORITY"
}

concept ConstitutionAgreement extends Agreement {
  o String organizationName
  o String organizationType
  o String missionStatement
  o String visionStatement optional
  o Article[] articles
  o Amendment[] amendments optional
  o VotingMechanism defaultVotingMechanism default="SIMPLE_MAJORITY"
  o Double quorumPercentage default=50.0
  o String membershipCriteria optional
  o String[] officerRoles optional
  o String amendmentProcess optional
  o String dissolutionProcess optional
}
`;

// Declaration model (manifestos, declarations of independence, founding documents)
const DECLARATION_MODEL = `
namespace org.sesap.declaration@1.0.0

import org.sesap.base@1.0.0.{Party, Agreement}

enum DeclarationType {
  o INDEPENDENCE
  o PRINCIPLES
  o MANIFESTO
  o CHARTER
  o PROCLAMATION
}

concept Principle {
  o Integer order
  o String title
  o String statement
  o String rationale optional
}

concept Grievance {
  o Integer order
  o String description
  o String evidence optional
}

concept Commitment {
  o Integer order
  o String commitment
  o String[] signatoryRoles optional
}

concept DeclarationAgreement extends Agreement {
  o DeclarationType declarationType default="PRINCIPLES"
  o String declarationName
  o String preamble
  o Principle[] principles optional
  o Grievance[] grievances optional
  o Commitment[] commitments optional
  o String[] coreValues optional
  o String callToAction optional
  o String closingStatement optional
  o Boolean requiresWitness default=false
  o Party[] witnesses optional
}
`;

export type AgreementType =
  | "collaboration"
  | "service"
  | "investment"
  | "custom"
  | "nda"
  | "nca"
  | "tos"
  | "constitution"
  | "declaration";

/**
 * Get the Concerto model for a specific agreement type
 */
export function getModelForType(type: AgreementType): string {
  const models: Record<AgreementType, string> = {
    collaboration: COLLABORATION_MODEL,
    service: SERVICE_MODEL,
    investment: INVESTMENT_MODEL,
    custom: CUSTOM_MODEL,
    nda: NDA_MODEL,
    nca: NCA_MODEL,
    tos: TOS_MODEL,
    constitution: CONSTITUTION_MODEL,
    declaration: DECLARATION_MODEL,
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
    nda: "org.sesap.nda@1.0.0.NDAgreement",
    nca: "org.sesap.nca@1.0.0.NCAgreement",
    tos: "org.sesap.tos@1.0.0.TOSAgreement",
    constitution: "org.sesap.constitution@1.0.0.ConstitutionAgreement",
    declaration: "org.sesap.declaration@1.0.0.DeclarationAgreement",
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
    nda: { content: NDA_MODEL, name: "nda.cto" },
    nca: { content: NCA_MODEL, name: "nca.cto" },
    tos: { content: TOS_MODEL, name: "tos.cto" },
    constitution: { content: CONSTITUTION_MODEL, name: "constitution.cto" },
    declaration: { content: DECLARATION_MODEL, name: "declaration.cto" },
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
    nda: [
      "ndaType",
      "disclosingParty",
      "receivingParty",
      "purposeOfDisclosure",
    ],
    nca: [
      "employer",
      "employee",
      "restrictedActivities",
      "geographicScope",
      "considerationProvided",
    ],
    tos: ["serviceName", "serviceDescription", "serviceProvider", "terms"],
    constitution: [
      "organizationName",
      "organizationType",
      "missionStatement",
      "articles",
    ],
    declaration: ["declarationType", "declarationName", "preamble"],
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
    nda: {
      ...baseData,
      title: "Non-Disclosure Agreement",
      ndaType: "BILATERAL",
      disclosingParty: {
        name: "Disclosing Party",
        walletAddress: "0x0000000000000000000000000000000000000001",
        role: "Disclosing Party",
      },
      receivingParty: {
        name: "Receiving Party",
        walletAddress: "0x0000000000000000000000000000000000000002",
        role: "Receiving Party",
      },
      purposeOfDisclosure: "Business collaboration and evaluation",
      confidentialityPeriodMonths: 24,
      confidentialInfo: [
        {
          category: "Business Information",
          description:
            "Financial data, business strategies, and customer lists",
          level: "CONFIDENTIAL",
        },
      ],
    },
    nca: {
      ...baseData,
      title: "Non-Compete Agreement",
      employer: {
        name: "Company Name",
        walletAddress: "0x0000000000000000000000000000000000000001",
        role: "Employer",
      },
      employee: {
        name: "Employee Name",
        walletAddress: "0x0000000000000000000000000000000000000002",
        role: "Employee",
      },
      restrictedActivities: [
        {
          activity: "Competing business operation",
          description: "Operating or being employed by a competing business",
        },
      ],
      geographicScope: [
        {
          region: "United States",
          description: "All 50 states and territories",
        },
      ],
      nonCompetePeriodMonths: 12,
      considerationProvided:
        "Employment and compensation as outlined in employment agreement",
    },
    tos: {
      ...baseData,
      title: "Terms of Service",
      serviceName: "Platform Name",
      serviceDescription:
        "A description of the platform or service being provided",
      serviceProvider: {
        name: "Service Provider",
        walletAddress: "0x0000000000000000000000000000000000000001",
        role: "Service Provider",
      },
      terms: [
        {
          title: "Acceptance of Terms",
          content:
            "By accessing or using this service, you agree to be bound by these terms.",
          order: 1,
          required: true,
        },
        {
          title: "User Responsibilities",
          content:
            "Users must comply with all applicable laws and regulations.",
          order: 2,
          required: true,
        },
      ],
      acceptableUsePolicies: [
        "No illegal activities",
        "No harassment or abuse",
      ],
      prohibitedActivities: [
        "Hacking or unauthorized access",
        "Distribution of malware",
      ],
    },
    constitution: {
      ...baseData,
      title: "Organization Constitution",
      organizationName: "Organization Name",
      organizationType: "DAO",
      missionStatement: "To advance the mission and goals of the organization",
      visionStatement: "A vision for what the organization aims to achieve",
      articles: [
        {
          articleNumber: 1,
          title: "Name and Purpose",
          content: "This organization shall be known as...",
          sections: ["Section 1.1: Name", "Section 1.2: Purpose"],
        },
        {
          articleNumber: 2,
          title: "Membership",
          content: "Membership criteria and rights...",
          sections: [
            "Section 2.1: Eligibility",
            "Section 2.2: Rights and Duties",
          ],
        },
      ],
      defaultVotingMechanism: "SIMPLE_MAJORITY",
      quorumPercentage: 50.0,
      amendments: [],
    },
    declaration: {
      ...baseData,
      title: "Declaration of Principles",
      declarationType: "PRINCIPLES",
      declarationName: "Declaration Name",
      preamble:
        "We, the undersigned, hereby declare our commitment to the following principles...",
      principles: [
        {
          order: 1,
          title: "First Principle",
          statement: "We believe in...",
          rationale: "Because...",
        },
      ],
      coreValues: ["Transparency", "Collaboration", "Innovation"],
      callToAction:
        "We call upon all stakeholders to join us in this endeavor.",
      closingStatement: "In witness whereof, we have set our hands and seals.",
    },
  };

  return typeSpecificData[type];
}
