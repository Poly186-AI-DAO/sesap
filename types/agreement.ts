/**
 * Shared Agreement Types
 */

export interface Party {
  id: string;
  name: string;
  walletAddress: string;
  role: string;
  email?: string | null;
  signature?: {
    signature: string;
    signedAt: string;
  } | null;
}

export interface Agreement {
  id: string;
  title: string;
  description?: string | null;
  templateId?: string | null; // Agreement type (collaboration, service, etc.)
  status: string;
  contractText?: string | null;
  templateData?: Record<string, unknown> | null;
  parties: Party[];
  createdAt: string;
  updatedAt: string;
  effectiveDate?: string | null;
  expirationDate?: string | null;
  ipfsHash?: string | null;
  txHash?: string | null;
  creator?: {
    id: string;
    name?: string | null;
    walletAddress: string;
  };
}

// Helper to get display type from templateId
export function getAgreementType(agreement: Agreement): string {
  return agreement.templateId || "custom";
}
