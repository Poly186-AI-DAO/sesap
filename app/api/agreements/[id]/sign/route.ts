/**
 * Agreement Signature API Route
 * POST /api/agreements/[id]/sign - Sign an agreement with wallet
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Signature validation schema
const signatureSchema = z.object({
  walletAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address"),
  signature: z.string().min(1, "Signature is required"),
  message: z.string().optional(), // The message that was signed
});

/**
 * POST /api/agreements/[id]/sign - Sign agreement
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Validate request body
    const validationResult = signatureSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { walletAddress, signature } = validationResult.data;

    // Get agreement with parties
    const agreement = await prisma.agreement.findUnique({
      where: { id },
      include: {
        parties: true,
        signatures: true,
      },
    });

    if (!agreement) {
      return NextResponse.json(
        { error: "Agreement not found" },
        { status: 404 }
      );
    }

    // Check agreement is in a signable state
    if (!["DRAFT", "PENDING_SIGNATURES"].includes(agreement.status)) {
      return NextResponse.json(
        { error: "Agreement cannot be signed in current status" },
        { status: 400 }
      );
    }

    // Check signer is a party to the agreement
    const isParty = agreement.parties.some(
      (p) => p.walletAddress.toLowerCase() === walletAddress.toLowerCase()
    );

    if (!isParty) {
      return NextResponse.json(
        { error: "Signer is not a party to this agreement" },
        { status: 403 }
      );
    }

    // Find or create user for signer
    let user = await prisma.user.findUnique({
      where: { walletAddress },
    });

    if (!user) {
      const party = agreement.parties.find(
        (p) => p.walletAddress.toLowerCase() === walletAddress.toLowerCase()
      );
      user = await prisma.user.create({
        data: {
          walletAddress,
          name: party?.name,
          email: party?.email,
        },
      });
    }

    // Check if already signed
    const existingSignature = agreement.signatures.find(
      (s) => s.userId === user.id
    );

    if (existingSignature) {
      return NextResponse.json(
        { error: "Agreement already signed by this user" },
        { status: 400 }
      );
    }

    // Create signature
    const newSignature = await prisma.signature.create({
      data: {
        agreementId: id,
        userId: user.id,
        signature,
        ipAddress:
          request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip") ||
          null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            walletAddress: true,
          },
        },
      },
    });

    // Check if all parties have signed
    const allPartiesWallets = agreement.parties.map((p) =>
      p.walletAddress.toLowerCase()
    );

    // Get all signatures including the new one
    const allSignatures = await prisma.signature.findMany({
      where: { agreementId: id },
      include: {
        user: {
          select: { walletAddress: true },
        },
      },
    });

    const signedWallets = allSignatures.map((s) =>
      s.user.walletAddress.toLowerCase()
    );

    const allSigned = allPartiesWallets.every((wallet) =>
      signedWallets.includes(wallet)
    );

    // Update agreement status if needed
    let newStatus = agreement.status;
    if (agreement.status === "DRAFT") {
      newStatus = "PENDING_SIGNATURES";
    }
    if (allSigned) {
      newStatus = "ACTIVE";
    }

    if (newStatus !== agreement.status) {
      await prisma.agreement.update({
        where: { id },
        data: { status: newStatus },
      });
    }

    return NextResponse.json({
      signature: newSignature,
      allSigned,
      status: newStatus,
    });
  } catch (error) {
    console.error("Error signing agreement:", error);
    return NextResponse.json(
      { error: "Failed to sign agreement" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/agreements/[id]/sign - Get signature status
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const agreement = await prisma.agreement.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        parties: {
          select: {
            name: true,
            walletAddress: true,
            role: true,
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
    });

    if (!agreement) {
      return NextResponse.json(
        { error: "Agreement not found" },
        { status: 404 }
      );
    }

    // Build signature status for each party
    const signatureStatus = agreement.parties.map((party) => {
      const signature = agreement.signatures.find(
        (s) =>
          s.user.walletAddress.toLowerCase() ===
          party.walletAddress.toLowerCase()
      );
      return {
        party: {
          name: party.name,
          walletAddress: party.walletAddress,
          role: party.role,
        },
        signed: !!signature,
        signedAt: signature?.signedAt || null,
      };
    });

    const allSigned = signatureStatus.every((s) => s.signed);
    const signedCount = signatureStatus.filter((s) => s.signed).length;

    return NextResponse.json({
      agreementId: agreement.id,
      status: agreement.status,
      signatureStatus,
      summary: {
        total: agreement.parties.length,
        signed: signedCount,
        pending: agreement.parties.length - signedCount,
        allSigned,
      },
    });
  } catch (error) {
    console.error("Error fetching signature status:", error);
    return NextResponse.json(
      { error: "Failed to fetch signature status" },
      { status: 500 }
    );
  }
}
