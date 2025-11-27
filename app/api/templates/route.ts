/**
 * Templates API Routes
 * GET /api/templates - List all templates
 * POST /api/templates - Create a new template
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { TEMPLATE_CATEGORIES } from "@/lib/templates/constants";
import { z } from "zod";

// Request validation schema for creating templates
const createTemplateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  category: z.enum(TEMPLATE_CATEGORIES),
  modelCto: z.string().min(1, "Concerto model is required"),
  grammarMd: z.string().min(1, "Grammar template is required"),
  logicErgo: z.string().optional(),
  isPublic: z.boolean().default(true),
});

/**
 * GET /api/templates - List all templates
 * Query params:
 * - category: filter by category
 * - search: search by name or description
 * - isPublic: filter by visibility (default: true)
 * - limit: max results (default 50)
 * - offset: pagination offset
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const search = searchParams.get("search");
    const isPublic = searchParams.get("isPublic") !== "false";
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Build where clause
    const where: Record<string, unknown> = {
      isPublic,
    };

    if (category) {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    // Get templates with count
    const [templates, total] = await Promise.all([
      prisma.template.findMany({
        where,
        orderBy: [{ category: "asc" }, { name: "asc" }],
        take: limit,
        skip: offset,
      }),
      prisma.template.count({ where }),
    ]);

    return NextResponse.json({
      templates,
      total,
      limit,
      offset,
      categories: TEMPLATE_CATEGORIES,
    });
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/templates - Create a new template
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const validationResult = createTemplateSchema.safeParse(body);
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
      modelCto,
      grammarMd,
      logicErgo,
      isPublic,
    } = validationResult.data;

    // Create the template
    const template = await prisma.template.create({
      data: {
        name,
        description,
        category,
        modelCto,
        grammarMd,
        logicErgo,
        isPublic,
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error("Error creating template:", error);
    return NextResponse.json(
      {
        error: "Failed to create template",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
