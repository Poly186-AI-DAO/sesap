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
  type: string;
  status: string;
  contractText: string;
  templateData: Record<string, unknown>;
  parties: Party[];
  createdAt: string;
  updatedAt: string;
  ipfsHash?: string | null;
  txHash?: string | null;
}
