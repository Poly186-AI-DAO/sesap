/**
 * Transcript Analysis API
 * POST /api/agents/analyze - Analyze a transcript or document to extract SSC elements
 */

import { NextRequest, NextResponse } from "next/server";
import {
  analyzeTranscript,
  createAgreementFromElements,
} from "@/lib/ai/openai";
import { z } from "zod";

// Request validation schema
const analyzeSchema = z.object({
  transcript: z.string().min(50, "Transcript must be at least 50 characters"),
  context: z.string().optional(),
  generateDraft: z.boolean().default(false),
  walletAddresses: z.record(z.string(), z.string()).optional(),
});

/**
 * POST /api/agents/analyze - Analyze transcript and extract SSC elements
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const validationResult = analyzeSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { transcript, context, generateDraft, walletAddresses } =
      validationResult.data;

    // Analyze the transcript
    const elements = await analyzeTranscript({
      transcript,
      context,
    });

    // Optionally generate a draft agreement
    let draftAgreement = null;
    if (generateDraft && walletAddresses) {
      draftAgreement = await createAgreementFromElements(
        elements,
        walletAddresses
      );
    }

    return NextResponse.json({
      elements,
      draftAgreement,
    });
  } catch (error) {
    console.error("Error analyzing transcript:", error);
    return NextResponse.json(
      {
        error: "Failed to analyze transcript",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
