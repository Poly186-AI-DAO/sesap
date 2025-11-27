/**
 * Single Agreement API Routes
 * GET /api/agreements/[id] - Get agreement by ID
 * PATCH /api/agreements/[id] - Update agreement
 * DELETE /api/agreements/[id] - Delete agreement (if draft)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { refineContract } from "@/lib/ai/openai";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Update validation schema
const updateAgreementSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  contractText: z.string().optional(),
  templateData: z.record(z.string(), z.unknown()).optional(),
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
  expirationDate: z.string().datetime().optional().nullable(),
  // AI refinement
  refineFeedback: z.string().optional(),
});

/**
 * GET /api/agreements/[id] - Get single agreement
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const agreement = await prisma.agreement.findUnique({
      where: { id },
      include: {
        parties: true,
        creator: {
          select: {
            id: true,
            name: true,
            walletAddress: true,
            email: true,
          },
        },
        signatures: {
          include: {
            user: {
              select: {
                id: true,
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

    return NextResponse.json(agreement);
  } catch (error) {
    console.error("Error fetching agreement:", error);
    return NextResponse.json(
      { error: "Failed to fetch agreement" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/agreements/[id] - Update agreement
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Validate request body
    const validationResult = updateAgreementSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    // Check agreement exists
    const existing = await prisma.agreement.findUnique({
      where: { id },
      select: { id: true, status: true, contractText: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Agreement not found" },
        { status: 404 }
      );
    }

    // Only allow updates on DRAFT agreements (except status changes)
    const data = validationResult.data;
    if (
      existing.status !== "DRAFT" &&
      Object.keys(data).some((k) => k !== "status")
    ) {
      return NextResponse.json(
        { error: "Can only update draft agreements" },
        { status: 400 }
      );
    }

    // Handle AI refinement if feedback provided
    let contractText = data.contractText;
    if (data.refineFeedback && existing.contractText) {
      contractText = await refineContract(
        existing.contractText,
        data.refineFeedback
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (data.title) updateData.title = data.title;
    if (data.description !== undefined)
      updateData.description = data.description;
    if (contractText) updateData.contractText = contractText;
    if (data.templateData) updateData.templateData = data.templateData;
    if (data.status) updateData.status = data.status;
    if (data.effectiveDate)
      updateData.effectiveDate = new Date(data.effectiveDate);
    if (data.expirationDate !== undefined) {
      updateData.expirationDate = data.expirationDate
        ? new Date(data.expirationDate)
        : null;
    }

    // Update agreement
    const agreement = await prisma.agreement.update({
      where: { id },
      data: updateData,
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
          include: {
            user: {
              select: {
                id: true,
                name: true,
                walletAddress: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(agreement);
  } catch (error) {
    console.error("Error updating agreement:", error);
    return NextResponse.json(
      { error: "Failed to update agreement" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/agreements/[id] - Delete agreement (draft only)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Check agreement exists and is draft
    const existing = await prisma.agreement.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Agreement not found" },
        { status: 404 }
      );
    }

    if (existing.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Can only delete draft agreements" },
        { status: 400 }
      );
    }

    // Delete agreement (cascades to parties)
    await prisma.agreement.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting agreement:", error);
    return NextResponse.json(
      { error: "Failed to delete agreement" },
      { status: 500 }
    );
  }
}
