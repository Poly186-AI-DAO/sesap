/**
 * Template Generation API
 * POST /api/templates/generate - Generate a new template using AI
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { generateTemplate } from "@/lib/ai/openai";
import { TEMPLATE_CATEGORIES } from "@/lib/templates/constants";
import { z } from "zod";

// Request validation schema
const generateTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  category: z.enum(TEMPLATE_CATEGORIES),
  templateType: z.enum([
    "nda",
    "nca",
    "tos",
    "constitution",
    "declaration",
    "collaboration",
    "service",
    "investment",
    "custom",
  ]),
  customRequirements: z.string().optional(),
  saveToDb: z.boolean().default(false),
  isPublic: z.boolean().default(true),
});

/**
 * POST /api/templates/generate - Generate a new template using AI
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const validationResult = generateTemplateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const {
      name,
      description,
      category,
      templateType,
      customRequirements,
      saveToDb,
      isPublic,
    } = validationResult.data;

    // Generate template using AI
    const generated = await generateTemplate({
      name,
      description,
      category,
      templateType,
      customRequirements,
    });

    // Optionally save to database
    let savedTemplate = null;
    if (saveToDb) {
      savedTemplate = await prisma.template.create({
        data: {
          name: generated.name,
          description: generated.description,
          category,
          modelCto: generated.modelCto,
          grammarMd: generated.grammarMd,
          logicErgo: generated.logicErgo,
          isPublic,
        },
      });
    }

    return NextResponse.json({
      template: savedTemplate || {
        name: generated.name,
        description: generated.description,
        category,
        modelCto: generated.modelCto,
        grammarMd: generated.grammarMd,
        logicErgo: generated.logicErgo,
      },
      saved: !!savedTemplate,
    });
  } catch (error) {
    console.error("Error generating template:", error);
    return NextResponse.json(
      {
        error: "Failed to generate template",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
