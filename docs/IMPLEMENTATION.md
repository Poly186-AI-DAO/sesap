# SESAP Implementation Guide

> **For Developers** - This document outlines the implementation pattern for SESAP MVP

---

## 📋 Pre-Implementation Checklist

Before starting, ensure you have:

- [ ] `.env` file configured (copy from `.env.example`)
- [ ] Web3Auth dashboard account with client ID
- [ ] OpenAI API key
- [ ] PostgreSQL database running
- [ ] Node.js 18+ installed
- [ ] pnpm installed (`npm install -g pnpm`)

---

## 🏗️ Project Structure to Implement

```
sesap/
├── app/                              # Next.js 14 App Router
│   ├── (auth)/                       # Public auth routes
│   │   ├── login/
│   │   │   └── page.tsx              # Login with Web3Auth
│   │   └── layout.tsx
│   │
│   ├── (dashboard)/                  # Protected routes
│   │   ├── layout.tsx                # Dashboard layout with sidebar
│   │   ├── page.tsx                  # Dashboard home
│   │   ├── agreements/
│   │   │   ├── page.tsx              # List all agreements
│   │   │   ├── new/
│   │   │   │   └── page.tsx          # Create new agreement
│   │   │   └── [id]/
│   │   │       └── page.tsx          # View/edit agreement
│   │   ├── templates/
│   │   │   └── page.tsx              # SSC templates library
│   │   └── settings/
│   │       └── page.tsx              # User settings
│   │
│   ├── api/                          # API routes
│   │   ├── auth/
│   │   │   └── verify/
│   │   │       └── route.ts          # Verify Web3Auth JWT
│   │   ├── agreements/
│   │   │   ├── route.ts              # CRUD agreements
│   │   │   ├── [id]/
│   │   │   │   └── route.ts          # Single agreement ops
│   │   │   └── generate/
│   │   │       └── route.ts          # AI generate agreement
│   │   └── templates/
│   │       └── route.ts              # Accord Project templates
│   │
│   ├── layout.tsx                    # Root layout
│   ├── page.tsx                      # Landing page
│   └── globals.css
│
├── components/
│   ├── ui/                           # shadcn/ui components
│   ├── auth/
│   │   └── web3auth-button.tsx       # Login button component
│   ├── agreements/
│   │   ├── agreement-form.tsx        # Create/edit form
│   │   ├── agreement-card.tsx        # Agreement preview card
│   │   ├── agreement-list.tsx        # List of agreements
│   │   └── signature-pad.tsx         # E-signature component
│   └── templates/
│       ├── template-selector.tsx     # Choose SSC template
│       └── variable-form.tsx         # Fill template variables
│
├── lib/
│   ├── web3auth/
│   │   ├── config.ts                 # Web3Auth configuration
│   │   ├── provider.tsx              # React context provider
│   │   └── hooks.ts                  # useWeb3Auth hook
│   ├── accord/
│   │   ├── engine.ts                 # Cicero engine wrapper
│   │   ├── templates.ts              # Template loading
│   │   └── models.ts                 # Concerto model helpers
│   ├── blockchain/
│   │   ├── client.ts                 # Viem/ethers client
│   │   ├── contracts.ts              # Contract ABIs & addresses
│   │   └── hooks.ts                  # useContract hooks
│   ├── ai/
│   │   └── openai.ts                 # OpenAI client for generation
│   ├── db/
│   │   ├── prisma.ts                 # Prisma client singleton
│   │   └── queries.ts                # Database queries
│   └── utils/
│       ├── ipfs.ts                   # IPFS upload/download
│       └── validation.ts             # Zod schemas
│
├── prisma/
│   ├── schema.prisma                 # Database schema
│   └── migrations/                   # Migration files
│
├── templates/                        # Accord Project templates
│   ├── collaboration/
│   │   ├── model.cto                 # Concerto data model
│   │   ├── grammar.tem.md            # Cicero template
│   │   ├── logic.ergo                # Ergo business logic
│   │   └── package.json              # Template metadata
│   └── service-agreement/
│       ├── model.cto
│       ├── grammar.tem.md
│       ├── logic.ergo
│       └── package.json
│
├── contracts/                        # Solidity contracts (Phase 2)
│   └── SSCRegistry.sol
│
├── public/
├── docs/                             # Existing documentation
├── .env                              # Environment variables
├── .env.example                      # Example env file
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.js
└── README.md
```

---

## 🔧 Implementation Order

### Phase 1: Foundation (Week 1)

#### Step 1.1: Project Setup
```bash
# Initialize Next.js project
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false

# Install core dependencies
pnpm add @web3auth/modal @web3auth/base ethers viem wagmi @tanstack/react-query
pnpm add @accordproject/cicero-core @accordproject/concerto-core
pnpm add openai zod prisma @prisma/client
pnpm add -D @types/node typescript

# Install UI dependencies
pnpm dlx shadcn-ui@latest init
pnpm dlx shadcn-ui@latest add button card input form dialog toast
```

#### Step 1.2: Database Schema
```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String      @id @default(cuid())
  walletAddress String      @unique
  email         String?
  name          String?
  avatar        String?
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
  
  agreements    Agreement[] @relation("CreatedAgreements")
  signatures    Signature[]
}

model Agreement {
  id              String      @id @default(cuid())
  title           String
  description     String?
  templateId      String?
  status          AgreementStatus @default(DRAFT)
  
  // Accord Project data
  templateData    Json?       // Concerto model data
  contractText    String?     // Rendered contract text
  
  // Blockchain data
  ipfsHash        String?     // Full document on IPFS
  txHash          String?     // Minting transaction
  contractAddress String?     // On-chain contract address
  
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  effectiveDate   DateTime?
  expirationDate  DateTime?
  
  creatorId       String
  creator         User        @relation("CreatedAgreements", fields: [creatorId], references: [id])
  
  parties         Party[]
  signatures      Signature[]
  
  @@index([creatorId])
  @@index([status])
}

model Party {
  id            String    @id @default(cuid())
  agreementId   String
  agreement     Agreement @relation(fields: [agreementId], references: [id], onDelete: Cascade)
  
  walletAddress String
  name          String
  email         String?
  role          String    // e.g., "Creator", "Collaborator", "Investor"
  
  @@index([agreementId])
}

model Signature {
  id            String    @id @default(cuid())
  agreementId   String
  agreement     Agreement @relation(fields: [agreementId], references: [id], onDelete: Cascade)
  
  userId        String
  user          User      @relation(fields: [userId], references: [id])
  
  signature     String    // Cryptographic signature
  signedAt      DateTime  @default(now())
  ipAddress     String?
  
  @@unique([agreementId, userId])
  @@index([agreementId])
}

model Template {
  id          String   @id @default(cuid())
  name        String
  description String?
  category    String
  
  modelCto    String   // Concerto model content
  grammarMd   String   // Cicero template content
  logicErgo   String?  // Ergo logic content
  
  isPublic    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

enum AgreementStatus {
  DRAFT
  PENDING_SIGNATURES
  ACTIVE
  EXECUTED
  EXPIRED
  CANCELLED
}
```

#### Step 1.3: Web3Auth Configuration
```typescript
// lib/web3auth/config.ts

import { Web3AuthOptions } from "@web3auth/modal";
import { CHAIN_NAMESPACES, WEB3AUTH_NETWORK } from "@web3auth/base";

const clientId = process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID!;

export const web3AuthConfig: Web3AuthOptions = {
  clientId,
  web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
  chainConfig: {
    chainNamespace: CHAIN_NAMESPACES.EIP155,
    chainId: "0x64", // Gnosis Chain (100 in hex)
    rpcTarget: process.env.NEXT_PUBLIC_GNOSIS_RPC_URL!,
    displayName: "Gnosis Chain",
    blockExplorerUrl: "https://gnosisscan.io",
    ticker: "xDAI",
    tickerName: "xDAI",
  },
  uiConfig: {
    appName: "SESAP",
    mode: "light",
    loginMethodsOrder: ["google", "discord", "email_passwordless"],
    defaultLanguage: "en",
  },
};
```

#### Step 1.4: Web3Auth Provider
```typescript
// lib/web3auth/provider.tsx

"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Web3Auth } from "@web3auth/modal";
import { web3AuthConfig } from "./config";

interface Web3AuthContextType {
  web3auth: Web3Auth | null;
  provider: any;
  user: any;
  isLoading: boolean;
  isConnected: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  getAddress: () => Promise<string | null>;
}

const Web3AuthContext = createContext<Web3AuthContextType | null>(null);

export function Web3AuthProvider({ children }: { children: ReactNode }) {
  const [web3auth, setWeb3auth] = useState<Web3Auth | null>(null);
  const [provider, setProvider] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const web3authInstance = new Web3Auth(web3AuthConfig);
        await web3authInstance.initModal();
        setWeb3auth(web3authInstance);

        if (web3authInstance.connected) {
          setProvider(web3authInstance.provider);
          const userInfo = await web3authInstance.getUserInfo();
          setUser(userInfo);
        }
      } catch (error) {
        console.error("Web3Auth init error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, []);

  const login = async () => {
    if (!web3auth) return;
    const web3authProvider = await web3auth.connect();
    setProvider(web3authProvider);
    const userInfo = await web3auth.getUserInfo();
    setUser(userInfo);
  };

  const logout = async () => {
    if (!web3auth) return;
    await web3auth.logout();
    setProvider(null);
    setUser(null);
  };

  const getAddress = async (): Promise<string | null> => {
    if (!provider) return null;
    const { ethers } = await import("ethers");
    const ethersProvider = new ethers.BrowserProvider(provider);
    const signer = await ethersProvider.getSigner();
    return signer.getAddress();
  };

  return (
    <Web3AuthContext.Provider
      value={{
        web3auth,
        provider,
        user,
        isLoading,
        isConnected: !!provider,
        login,
        logout,
        getAddress,
      }}
    >
      {children}
    </Web3AuthContext.Provider>
  );
}

export const useWeb3Auth = () => {
  const context = useContext(Web3AuthContext);
  if (!context) {
    throw new Error("useWeb3Auth must be used within Web3AuthProvider");
  }
  return context;
};
```

---

### Phase 2: Core Features (Week 2)

#### Step 2.1: Agreement Creation API
```typescript
// app/api/agreements/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

const createAgreementSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  templateId: z.string().optional(),
  templateData: z.record(z.any()).optional(),
  parties: z.array(z.object({
    walletAddress: z.string(),
    name: z.string(),
    email: z.string().email().optional(),
    role: z.string(),
  })),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = createAgreementSchema.parse(body);
    
    // Get creator from verified JWT (implement auth middleware)
    const creatorAddress = req.headers.get("x-wallet-address");
    if (!creatorAddress) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find or create user
    const user = await prisma.user.upsert({
      where: { walletAddress: creatorAddress },
      update: {},
      create: { walletAddress: creatorAddress },
    });

    // Create agreement with parties
    const agreement = await prisma.agreement.create({
      data: {
        title: data.title,
        description: data.description,
        templateId: data.templateId,
        templateData: data.templateData,
        creatorId: user.id,
        parties: {
          create: data.parties,
        },
      },
      include: {
        parties: true,
      },
    });

    return NextResponse.json(agreement, { status: 201 });
  } catch (error) {
    console.error("Create agreement error:", error);
    return NextResponse.json(
      { error: "Failed to create agreement" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const creatorAddress = req.headers.get("x-wallet-address");
    if (!creatorAddress) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { walletAddress: creatorAddress },
    });

    if (!user) {
      return NextResponse.json({ agreements: [] });
    }

    const agreements = await prisma.agreement.findMany({
      where: {
        OR: [
          { creatorId: user.id },
          { parties: { some: { walletAddress: creatorAddress } } },
        ],
      },
      include: {
        parties: true,
        signatures: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ agreements });
  } catch (error) {
    console.error("Get agreements error:", error);
    return NextResponse.json(
      { error: "Failed to fetch agreements" },
      { status: 500 }
    );
  }
}
```

#### Step 2.2: AI Agreement Generation
```typescript
// app/api/agreements/generate/route.ts

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const generateSchema = z.object({
  type: z.enum(["collaboration", "service", "investment", "custom"]),
  description: z.string(),
  parties: z.array(z.object({
    name: z.string(),
    role: z.string(),
  })),
  terms: z.record(z.any()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = generateSchema.parse(body);

    const prompt = `Generate a Smart Social Contract for the following:
    
Type: ${data.type}
Description: ${data.description}
Parties: ${JSON.stringify(data.parties)}
Additional Terms: ${JSON.stringify(data.terms || {})}

Generate the contract in the following format:
1. A Concerto model (.cto) defining the data structure
2. A Cicero template (.tem.md) with the natural language contract
3. Key variables that need to be filled in

Respond in JSON format with keys: model, template, variables`;

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: "You are an expert in creating Smart Legal Contracts using the Accord Project framework. Generate legally sound but accessible contract templates.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(completion.choices[0].message.content || "{}");

    return NextResponse.json(result);
  } catch (error) {
    console.error("Generate agreement error:", error);
    return NextResponse.json(
      { error: "Failed to generate agreement" },
      { status: 500 }
    );
  }
}
```

---

### Phase 3: E-Signature & Blockchain (Week 3)

#### Step 3.1: Signature Component
```typescript
// components/agreements/signature-pad.tsx

"use client";

import { useState } from "react";
import { useWeb3Auth } from "@/lib/web3auth/provider";
import { Button } from "@/components/ui/button";

interface SignaturePadProps {
  agreementId: string;
  agreementHash: string;
  onSigned: (signature: string) => void;
}

export function SignaturePad({ agreementId, agreementHash, onSigned }: SignaturePadProps) {
  const { provider, getAddress } = useWeb3Auth();
  const [isSigning, setIsSigning] = useState(false);

  const handleSign = async () => {
    if (!provider) return;

    setIsSigning(true);
    try {
      const { ethers } = await import("ethers");
      const ethersProvider = new ethers.BrowserProvider(provider);
      const signer = await ethersProvider.getSigner();

      // Create message to sign
      const message = `I agree to the terms of agreement ${agreementId}\n\nHash: ${agreementHash}\nTimestamp: ${Date.now()}`;

      // Sign the message
      const signature = await signer.signMessage(message);

      // Save signature to backend
      const address = await getAddress();
      await fetch(`/api/agreements/${agreementId}/sign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": address || "",
        },
        body: JSON.stringify({ signature, message }),
      });

      onSigned(signature);
    } catch (error) {
      console.error("Signing error:", error);
    } finally {
      setIsSigning(false);
    }
  };

  return (
    <Button onClick={handleSign} disabled={isSigning || !provider}>
      {isSigning ? "Signing..." : "Sign Agreement"}
    </Button>
  );
}
```

---

## 📊 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           SESAP DATA FLOW                                        │
└─────────────────────────────────────────────────────────────────────────────────┘

1. USER AUTHENTICATION
   ┌──────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────┐
   │  User    │────>│  Web3Auth    │────>│   MPC Key   │────>│  Wallet  │
   │  (Social)│     │  (Google/    │     │  Generation │     │  Created │
   │          │     │   Discord)   │     │             │     │          │
   └──────────┘     └──────────────┘     └─────────────┘     └──────────┘

2. AGREEMENT CREATION
   ┌──────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────┐
   │  User    │────>│  Select      │────>│   OpenAI    │────>│  Accord  │
   │  Input   │     │  Template    │     │  Generate   │     │  Project │
   │          │     │  or Custom   │     │  Contract   │     │  Render  │
   └──────────┘     └──────────────┘     └─────────────┘     └──────────┘
                                                                   │
                                                                   ▼
   ┌──────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────┐
   │  Review  │<────│  Variable    │<────│  Concerto   │<────│ Template │
   │  & Edit  │     │  Binding     │     │  Validation │     │  Loaded  │
   └──────────┘     └──────────────┘     └─────────────┘     └──────────┘

3. SIGNING & EXECUTION
   ┌──────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────┐
   │  Party   │────>│  E-Sign      │────>│  PostgreSQL │────>│  IPFS    │
   │  Signs   │     │  (ethers)    │     │  Store Sig  │     │  Upload  │
   └──────────┘     └──────────────┘     └─────────────┘     └──────────┘
                                                                   │
                                                                   ▼
   ┌──────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────┐
   │  Active  │<────│  Update      │<────│  Mint       │<────│  All     │
   │  SSC     │     │  Status      │     │  On-Chain   │     │  Signed  │
   └──────────┘     └──────────────┘     └─────────────┘     └──────────┘
```

---

## ✅ Implementation Checklist

### Week 1: Foundation
- [ ] Next.js project setup with TypeScript
- [ ] Tailwind + shadcn/ui components
- [ ] Web3Auth integration
- [ ] PostgreSQL + Prisma setup
- [ ] Basic authentication flow
- [ ] Protected routes

### Week 2: Core Features
- [ ] Agreement CRUD API
- [ ] Agreement creation form
- [ ] Template selector component
- [ ] OpenAI integration for generation
- [ ] Agreement list view

### Week 3: Signatures & Storage
- [ ] E-signature component
- [ ] IPFS integration
- [ ] Document preview
- [ ] Signature verification API

### Week 4: Polish & Deploy
- [ ] Error handling
- [ ] Loading states
- [ ] Responsive design
- [ ] Testing
- [ ] Deployment to Vercel

---

## 🚨 Important Notes

1. **Web3Auth is FREE** for up to 1,000 MAW/month - sufficient for MVP
2. **Accord Project** templates must be loaded server-side (Node.js)
3. **Feature flags** in `.env` allow gradual feature rollout
4. **Abstract the auth layer** for future migration to Openfort

---

## 📚 Reference Documentation

- [Web3Auth Docs](https://web3auth.io/docs/)
- [Accord Project Docs](https://docs.accordproject.org/)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Prisma Docs](https://www.prisma.io/docs)
- [OpenAI API](https://platform.openai.com/docs)

---

## 🆘 Getting Help

1. Check existing docs in `/docs` folder
2. Review SESAP Overview and SSC Technicals docs
3. Web3Auth Discord: https://discord.gg/web3auth
4. Accord Project Discord: https://discord.gg/Zm99SKhhtA
