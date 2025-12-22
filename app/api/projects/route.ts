/**
 * Projects API - List and Create
 *
 * GET /api/projects - List user's projects
 * POST /api/projects - Create new project
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { z } from "zod";
import { guruProfileDataSchema, synthesisModeSchema } from "@/lib/guruProfile/types";

// Validation schema for creating a project
const createProjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().optional(),
  // Optional guru profile from onboarding
  guruProfile: z.object({
    rawBrainDump: z.string().min(1, "Brain dump is required"),
    synthesisMode: synthesisModeSchema,
    profileData: guruProfileDataSchema,
    lightAreas: z.array(z.string()),
  }).optional(),
});

/**
 * GET /api/projects
 * List user's projects with their counts
 */
export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projects = await prisma.project.findMany({
      where: { userId: user.id },
      include: {
        _count: {
          select: {
            contextLayers: true,
            knowledgeFiles: true,
            researchRuns: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      projects,
      total: projects.length,
    });
  } catch (error) {
    console.error("[Projects API] GET error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch projects",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects
 * Create a new project for the current user
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Validate input
    const result = createProjectSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: result.error.format(),
        },
        { status: 400 }
      );
    }

    const { name, description, guruProfile } = result.data;

    // Create project with optional guru profile in a transaction
    const project = await prisma.$transaction(async (tx) => {
      // Create the project first
      const newProject = await tx.project.create({
        data: {
          name,
          description,
          userId: user.id,
        },
      });

      // If guru profile provided, create it and link to project
      if (guruProfile) {
        const profile = await tx.guruProfile.create({
          data: {
            projectId: newProject.id,
            rawBrainDump: guruProfile.rawBrainDump,
            synthesisMode: guruProfile.synthesisMode,
            profileData: guruProfile.profileData,
            lightAreas: guruProfile.lightAreas,
            version: 1,
          },
        });

        // Update project with current profile reference
        await tx.project.update({
          where: { id: newProject.id },
          data: { currentProfileId: profile.id },
        });
      }

      // Return project with counts and optional profile
      return tx.project.findUnique({
        where: { id: newProject.id },
        include: {
          _count: {
            select: {
              contextLayers: true,
              knowledgeFiles: true,
              researchRuns: true,
            },
          },
          currentProfile: true,
        },
      });
    });

    return NextResponse.json(
      {
        project,
        message: "Project created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[Projects API] POST error:", error);
    return NextResponse.json(
      {
        error: "Failed to create project",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
