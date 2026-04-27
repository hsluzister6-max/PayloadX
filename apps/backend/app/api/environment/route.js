import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Environment, { maskSecrets } from '@/models/Environment';
import { authenticate } from '@/lib/auth';

// ─── GET /api/environment ─────────────────────────────────────────────────────
// Query params: projectId (required), teamId (optional), includeGlobal (bool)
export async function GET(request) {
  const { error, user } = await authenticate(request);
  if (error) return error;

  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const projectId    = searchParams.get('projectId');
    const teamId       = searchParams.get('teamId');
    const includeGlobal = searchParams.get('includeGlobal') === 'true';

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId query param is required' },
        { status: 400 }
      );
    }

    // Build query — optionally include global team environments
    let envs;
    if (includeGlobal && teamId) {
      envs = await Environment.find({
        $or: [
          { projectId },
          { teamId, isGlobal: true },
        ],
      }).sort({ isGlobal: -1, name: 1 }); // Global envs first
    } else {
      envs = await Environment.find({ projectId }).sort({ name: 1 });
    }

    // Mask secret values before sending
    const safeEnvs = envs.map(maskSecrets);

    return NextResponse.json({
      environments: safeEnvs,
      count: safeEnvs.length,
    });
  } catch (err) {
    console.error('[GET /api/environment]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST /api/environment ────────────────────────────────────────────────────
// Create a new environment with optional initial variables
export async function POST(request) {
  const { error, user } = await authenticate(request);
  if (error) return error;

  try {
    await connectDB();
    const body = await request.json();
    const {
      name,
      projectId,
      teamId,
      description = '',
      color = '#6366f1',
      isGlobal = false,
      variables = [],
    } = body;

    // Validate required fields
    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'Environment name is required' },
        { status: 400 }
      );
    }
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }
    if (!teamId) {
      return NextResponse.json({ error: 'teamId is required' }, { status: 400 });
    }

    // Check for duplicate name in project
    const existing = await Environment.findOne({ projectId, name: name.trim() });
    if (existing) {
      return NextResponse.json(
        { error: `An environment named "${name.trim()}" already exists in this project` },
        { status: 409 }
      );
    }

    // Sanitize and validate variables
    const sanitizedVars = sanitizeVariables(variables);

    const env = await Environment.create({
      name: name.trim(),
      description: description.trim(),
      projectId,
      teamId,
      createdBy: user.id,
      color,
      isGlobal,
      variables: sanitizedVars,
    });

    return NextResponse.json(
      { message: 'Environment created', environment: maskSecrets(env) },
      { status: 201 }
    );
  } catch (err) {
    console.error('[POST /api/environment]', err);
    if (err.code === 11000) {
      return NextResponse.json(
        { error: 'An environment with this name already exists in this project' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sanitizeVariables(variables = []) {
  if (!Array.isArray(variables)) return [];
  return variables
    .filter((v) => v.key && v.key.trim())       // Skip vars with no key
    .map((v) => ({
      key: v.key.trim(),
      value: v.value ?? '',
      description: v.description ?? '',
      isSecret: Boolean(v.isSecret),
      enabled: v.enabled !== false,
    }));
}
