import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Environment, { maskSecrets } from '@/models/Environment';
import { authenticate } from '@/lib/auth';

// ─── GET /api/environment/:id/variables ───────────────────────────────────────
// List all variables (secrets masked unless ?revealSecrets=true)
export async function GET(request, { params }) {
  const { error } = await authenticate(request);
  if (error) return error;

  try {
    await connectDB();
    const env = await Environment.findById(params.id);
    if (!env) return NextResponse.json({ error: 'Environment not found' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const revealSecrets = searchParams.get('revealSecrets') === 'true';

    const variables = env.variables.map((v) => ({
      _id: v._id,
      key: v.key,
      value: v.isSecret && !revealSecrets ? '' : v.value,
      description: v.description,
      isSecret: v.isSecret,
      enabled: v.enabled,
      _masked: v.isSecret && !revealSecrets,
    }));

    return NextResponse.json({ variables, count: variables.length });
  } catch (err) {
    console.error('[GET /api/environment/:id/variables]', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

// ─── POST /api/environment/:id/variables ──────────────────────────────────────
// Add a single variable
export async function POST(request, { params }) {
  const { error } = await authenticate(request);
  if (error) return error;

  try {
    await connectDB();
    const { key, value = '', description = '', isSecret = false, enabled = true } = await request.json();

    if (!key?.trim()) {
      return NextResponse.json({ error: 'Variable key is required' }, { status: 400 });
    }

    const env = await Environment.findById(params.id);
    if (!env) return NextResponse.json({ error: 'Environment not found' }, { status: 404 });

    // Check duplicate key
    if (env.variables.some((v) => v.key === key.trim())) {
      return NextResponse.json(
        { error: `Variable "${key.trim()}" already exists in this environment` },
        { status: 409 }
      );
    }

    env.variables.push({ key: key.trim(), value, description, isSecret, enabled });
    await env.save();

    return NextResponse.json({
      message: 'Variable added',
      variable: env.variables[env.variables.length - 1],
    }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/environment/:id/variables]', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

// ─── PUT /api/environment/:id/variables ───────────────────────────────────────
// Bulk replace all variables (used when saving the full variable list)
export async function PUT(request, { params }) {
  const { error } = await authenticate(request);
  if (error) return error;

  try {
    await connectDB();
    const { variables } = await request.json();

    if (!Array.isArray(variables)) {
      return NextResponse.json({ error: 'variables must be an array' }, { status: 400 });
    }

    const env = await Environment.findById(params.id);
    if (!env) return NextResponse.json({ error: 'Environment not found' }, { status: 404 });

    // Smart merge — preserve secret values for masked items
    const merged = variables
      .filter((v) => v.key?.trim())
      .map((incoming) => {
        const existing = env.variables.find((e) => e.key === incoming.key.trim());
        const isSecret = Boolean(incoming.isSecret);
        let value = incoming.value ?? '';
        if (isSecret && value === '' && existing?.isSecret) value = existing.value;
        return {
          key: incoming.key.trim(),
          value,
          description: incoming.description ?? '',
          isSecret,
          enabled: incoming.enabled !== false,
        };
      });

    env.variables = merged;
    await env.save();

    return NextResponse.json({
      message: 'Variables saved',
      count: merged.length,
      environment: maskSecrets(env),
    });
  } catch (err) {
    console.error('[PUT /api/environment/:id/variables]', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
