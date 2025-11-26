# SESAP - Self-Executing Social Agreements Platform

> **Architects of Reality** - Aligning incentives through automated, codified social agreements

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Built with Accord Project](https://img.shields.io/badge/Built%20with-Accord%20Project-blue)](https://accordproject.org/)

## 🌍 Overview

**SESAP (Self-Executing Social Agreements Platform)** is a decentralized application that enables individuals, organizations, and machines to create and execute automated social agreements using AI and smart contracts.

**Smart Social Contracts (SSCs)** combine the traditional theory of social contracts with blockchain technology to create explicit agreements with clear rules of collaboration that:

- ✅ Align incentives of all parties
- ✅ Automate execution when conditions are met
- ✅ Ensure accountability and transparency
- ✅ Enable decentralized collaboration

### The Problem

Current social contracts between individuals, corporations, and governments maintain systems that perpetuate climate change, poverty, food insecurity, and social unrest. We lack a platform to align incentives and hold each other accountable at scale.

### The Solution

SESAP provides:
- **Agreement Creation** - User-friendly interface with AI assistance
- **Automated Execution** - Smart contracts execute when conditions are met  
- **Transparent Management** - Track, monitor, and verify all agreements
- **Decentralized Trust** - Blockchain-backed accountability

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              SESAP PLATFORM                                      │
└─────────────────────────────────────────────────────────────────────────────────┘
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        │                              │                              │
        ▼                              ▼                              ▼
┌───────────────────┐    ┌───────────────────────┐    ┌───────────────────────┐
│   AUTHENTICATION  │    │    AGREEMENT LAYER    │    │   BLOCKCHAIN LAYER    │
│    (Web3Auth)     │    │   (Accord Project)    │    │      (Gnosis)         │
├───────────────────┤    ├───────────────────────┤    ├───────────────────────┤
│                   │    │                       │    │                       │
│  Social Login:    │    │  CONCERTO:            │    │  Smart Contracts:     │
│  - Google         │    │  - Data Models        │    │  - SSC Registry       │
│  - Discord        │    │  - Party definitions  │    │  - Escrow             │
│  - Email          │    │  - KPI structures     │    │  - Reputation (Colony)│
│       ↓           │    │                       │    │                       │
│  MPC Wallet       │    │  CICERO:              │    │  Storage:             │
│  Generation       │    │  - Template Engine    │    │  - Contract hashes    │
│       ↓           │    │  - Natural Language   │    │  - Signatures         │
│  Non-custodial    │    │  - Variable Binding   │    │  - State changes      │
│  (no seed phrase) │    │                       │    │                       │
│                   │    │  ERGO:                │    │  IPFS:                │
│                   │    │  - Business Logic     │    │  - Full documents     │
│                   │    │  - Auto-execution     │    │  - Attachments        │
└───────────────────┘    └───────────────────────┘    └───────────────────────┘
                                       │
                                       ▼
                    ┌───────────────────────────────────┐
                    │        AI LAYER (OpenAI)          │
                    ├───────────────────────────────────┤
                    │  GPT-4: Contract Generation       │
                    │  Document AI: PDF Analysis        │
                    │  Recommendations: Template Match  │
                    └───────────────────────────────────┘
```

---

## 🛠️ Tech Stack

### Core Technologies

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | Next.js 14+ (App Router) | Web application |
| **Auth & Wallet** | Web3Auth | Social login → wallet creation |
| **Agreements** | Accord Project | Smart legal contract templates |
| **Blockchain** | Gnosis Chain | On-chain execution & storage |
| **AI** | OpenAI API | Contract generation & analysis |
| **Database** | PostgreSQL + Prisma | User & agreement metadata |
| **Storage** | IPFS | Decentralized document storage |

### Key Packages

```bash
# Authentication & Wallet
@web3auth/modal              # Social login with wallet creation

# Smart Legal Contracts (Accord Project)
@accordproject/cicero-core   # Template engine
@accordproject/concerto-core # Data modeling
@accordproject/cicero-engine # Contract execution

# Blockchain
ethers / viem                # Ethereum interaction
wagmi                        # React hooks for Ethereum

# AI
openai                       # GPT-4 for contract generation
```

### Why This Stack?

#### Web3Auth (for MVP)
- **1,000 free users/month** - Sufficient for MVP validation
- **Proven at scale** - 15M+ users onboarded
- **Best docs & examples** - Fastest implementation path
- **Swappable** - Can migrate to Openfort (open-source) post-MVP

#### Accord Project
- **100% Open Source** - Linux Foundation backed
- **Human + Machine Readable** - Lawyers can draft, computers can execute
- **Blockchain Agnostic** - Works with any chain
- **Template Library** - Pre-built legal contract templates

---

## 📋 MVP Roadmap

### Phase 1: Simple Agreement Creation
- [ ] Social login (Google, Discord, Email)
- [ ] E-signature functionality
- [ ] Driver's license upload (identity verification)
- [ ] Basic agreement monitoring

### Phase 2: Contract Minting & Analysis
- [ ] Mint agreements on Gnosis Chain
- [ ] Customizable contract templates
- [ ] Document AI for PDF analysis
- [ ] Accord Project template integration

### Phase 3: Organization Management
- [ ] Company/organization structures
- [ ] Job posting generation
- [ ] Multi-party agreements

### Phase 4: Cloud Talent Features
- [ ] GPT-powered applicant testing
- [ ] Organization understanding verification

### Phase 5: Document Management
- [ ] DocAI Warehouse integration
- [ ] Discovery engine for templates

### Phase 6: Enhanced UX
- [ ] Multi-language translation
- [ ] AI recommendations
- [ ] Cross-industry discovery

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ (LTS)
- pnpm (recommended) or npm
- PostgreSQL database
- Web3Auth account (free tier)
- OpenAI API key

### Installation

```bash
# Clone the repository
git clone https://github.com/Poly186-AI-DAO/sesap.git
cd sesap

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your API keys

# Run database migrations
pnpm db:migrate

# Start development server
pnpm dev
```

### Environment Variables

```env
# Web3Auth
NEXT_PUBLIC_WEB3AUTH_CLIENT_ID=your_client_id

# OpenAI
OPENAI_API_KEY=your_openai_key

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/sesap

# Blockchain (Gnosis)
NEXT_PUBLIC_GNOSIS_RPC_URL=https://rpc.gnosischain.com
```

---

## 📁 Project Structure

```
sesap/
├── apps/
│   └── web/                          # Next.js application
│       ├── app/
│       │   ├── (auth)/               # Auth routes
│       │   ├── (dashboard)/          # Protected routes
│       │   │   ├── agreements/       # Agreement CRUD
│       │   │   ├── templates/        # SSC templates
│       │   │   └── organizations/    # Org management
│       │   └── api/                  # API routes
│       └── providers/
│           └── web3auth-provider.tsx
│
├── packages/
│   ├── contracts/                    # Accord Project templates
│   │   ├── models/                   # Concerto data models (.cto)
│   │   ├── templates/                # Cicero templates
│   │   └── logic/                    # Ergo logic files (.ergo)
│   │
│   ├── blockchain/                   # On-chain contracts
│   │   └── contracts/                # Solidity contracts
│   │
│   └── shared/                       # Shared utilities
│       ├── types/
│       └── utils/
│
├── docs/                             # Documentation
└── README.md
```

---

## 🔐 Smart Social Contract (SSC) Example

### Concerto Data Model
```cto
namespace org.sesap.collaboration

concept Party {
  o String name
  o String walletAddress
  o String role
}

asset CollaborationAgreement identified by agreementId {
  o String agreementId
  o Party[] parties
  o DateTime effectiveDate
  o Double revenueSharePercentage
  o String[] kpis
}
```

### Cicero Template (Natural Language)
```md
## Collaboration Agreement

This agreement is entered into by {{parties}} on {{effectiveDate}}.

The parties agree to share revenue at {{revenueSharePercentage}}% 
based on the following KPIs: {{kpis}}.

Upon achievement of KPIs, funds will be automatically distributed 
from the escrow wallet to each party's wallet address.
```

### Ergo Logic (Execution)
```ergo
contract CollaborationAgreement over CollaborationAgreementModel {
  clause distribute(request: KPIAchievement): PaymentObligation {
    enforce request.kpiMet = true
    else throw "KPI not achieved";
    
    return PaymentObligation{
      amount: contract.escrowAmount * contract.revenueSharePercentage / 100,
      recipient: request.party.walletAddress
    }
  }
}
```

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📚 Resources

### Accord Project
- [Documentation](https://docs.accordproject.org/)
- [Template Playground](https://studio.accordproject.org/)
- [GitHub](https://github.com/accordproject)

### Web3Auth
- [Documentation](https://web3auth.io/docs/)
- [Dashboard](https://dashboard.web3auth.io/)
- [Examples](https://github.com/web3auth/web3auth-examples)

### SESAP Internal Docs
- [SESAP Overview](docs/SESAP%20Overview.md)
- [SSC Technicals](docs/SSC_%20Technicals_%20Internal.md)
- [MVP Roadmap](docs/SESAP%20MVP%20Roadmap_%20Internal.md)
- [User Stories](docs/SESAP%20MVP%20User%20Stories_%20Internal.md)

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Accord Project](https://accordproject.org/) - Smart Legal Contract framework
- [Web3Auth](https://web3auth.io/) - Wallet authentication infrastructure
- [Poly186](https://poly186.io/) - Architects of Reality

---

<p align="center">
  <strong>Built by <a href="https://poly186.io">Poly186</a></strong><br>
  <em>Automating the production and distribution of basic needs</em>
</p>
