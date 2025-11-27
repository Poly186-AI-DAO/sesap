/**
 * Agreements API Routes
 * POST /api/agreements - Create new agreement
 * GET /api/agreements - List user's agreements
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { generateContract, type Party } from "@/lib/ai/openai";
import { validateAgreementData, type AgreementType } from "@/lib/accord";
import { z } from "zod";

// Request validation schema
const createAgreementSchema = z.object({
  type: z.enum([
    "collaboration",
    "service",
    "investment",
    "custom",
    "nda",
    "nca",
    "tos",
    "constitution",
    "declaration",
  ]),
  description: z.string().min(10, "Description must be at least 10 characters"),
  parties: z
    .array(
      z.object({
        name: z.string().min(1),
        walletAddress: z
          .string()
          .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address"),
        role: z.string().min(1),
        email: z.string().email().optional(),
      })
    )
    .min(1, "At least one party is required"),
  terms: z.record(z.string(), z.unknown()).optional(),
  useAI: z.boolean().default(true),
  // Manual creation fields (when useAI is false)
  title: z.string().optional(),
  contractText: z.string().optional(),
});

/**
 * POST /api/agreements - Create a new agreement
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const validationResult = createAgreementSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { type, description, parties, terms, useAI, title, contractText } =
      validationResult.data;

    // Get creator from wallet address (first party or from auth)
    // TODO: Replace with actual auth when Web3Auth session is available
    const creatorWallet = parties[0].walletAddress;

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { walletAddress: creatorWallet },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          walletAddress: creatorWallet,
          name: parties[0].name,
          email: parties[0].email,
        },
      });
    }

    let agreementTitle: string;
    let agreementText: string;
    let templateData: Record<string, unknown>;

    if (useAI) {
      // Generate contract using AI
      const generated = await generateContract({
        type: type as AgreementType,
        description,
        parties: parties as Party[],
        terms,
      });

      agreementTitle = generated.title;
      agreementText = generated.markdown;
      templateData = generated.data;
    } else {
      // Manual creation
      if (!title || !contractText) {
        return NextResponse.json(
          { error: "Title and contract text required for manual creation" },
          { status: 400 }
        );
      }

      agreementTitle = title;
      agreementText = contractText;
      templateData = {
        title,
        description,
        effectiveDate: new Date().toISOString(),
        parties,
        ...terms,
      };
    }

    // Validate data against Concerto model (warning only, don't block)
    const validation = validateAgreementData(
      type as AgreementType,
      templateData
    );
    if (!validation.valid) {
      console.warn("Agreement data validation warnings:", validation.errors);
    }

    // Create the agreement in database
    const agreement = await prisma.agreement.create({
      data: {
        title: agreementTitle,
        description,
        templateId: type,
        status: "DRAFT",
        templateData: templateData as object,
        contractText: agreementText,
        effectiveDate: new Date(),
        creatorId: user.id,
        parties: {
          create: parties.map((party) => ({
            name: party.name,
            walletAddress: party.walletAddress,
            role: party.role,
            email: party.email,
          })),
        },
      },
      include: {
        parties: true,
        creator: {
          select: {
            id: true,
            name: true,
            walletAddress: true,
          },
        },
      },
    });

    return NextResponse.json(agreement, { status: 201 });
  } catch (error) {
    console.error("Error creating agreement:", error);
    return NextResponse.json(
      {
        error: "Failed to create agreement",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/agreements - List agreements
 * Query params:
 * - walletAddress: filter by creator wallet
 * - status: filter by status
 * - limit: max results (default 20)
 * - offset: pagination offset
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get("walletAddress");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Build where clause
    const where: Record<string, unknown> = {};

    if (walletAddress) {
      const user = await prisma.user.findUnique({
        where: { walletAddress },
        select: { id: true },
      });

      if (user) {
        where.creatorId = user.id;
      } else {
        // No user found, return empty
        return NextResponse.json({ agreements: [], total: 0 });
      }
    }

    if (status) {
      where.status = status;
    }

    // Get agreements with count
    const [agreements, total] = await Promise.all([
      prisma.agreement.findMany({
        where,
        include: {
          parties: true,
          creator: {
            select: {
              id: true,
              name: true,
              walletAddress: true,
            },
          },
          signatures: {
            select: {
              id: true,
              signedAt: true,
              user: {
                select: {
                  name: true,
                  walletAddress: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.agreement.count({ where }),
    ]);

    return NextResponse.json({
      agreements,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching agreements:", error);
    return NextResponse.json(
      { error: "Failed to fetch agreements" },
      { status: 500 }
    );
  }
}
