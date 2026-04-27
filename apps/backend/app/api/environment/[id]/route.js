import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Environment, { maskSecrets } from '@/models/Environment';
import { authenticate } from '@/lib/auth';

// ─── GET /api/environment/:id ─────────────────────────────────────────────────
// Returns full env including secret values (used when editing)
export async function GET(request, { params }) {
  const { error } = await authenticate(request);
  if (error) return error;

  try {
    await connectDB();
    const env = await Environment.findById(params.id);
    if (!env) return NextResponse.json({ error: 'Environment not found' }, { status: 404 });

    // Check if caller wants raw secrets (e.g. for editing)
    const { searchParams } = new URL(request.url);
    const revealSecrets = searchParams.get('revealSecrets') === 'true';

    return NextResponse.json({
      environment: revealSecrets ? env.toObject() : maskSecrets(env),
    });
  } catch (err) {
    console.error('[GET /api/environment/:id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── PUT /api/environment/:id ─────────────────────────────────────────────────
// Full update: name, description, color, isGlobal, variables array
export async function PUT(request, { params }) {
  const { error } = await authenticate(request);
  if (error) return error;

  try {
    await connectDB();
    const body = await request.json();
    const { name, description, color, isGlobal, variables } = body;

    const env = await Environment.findById(params.id);
    if (!env) return NextResponse.json({ error: 'Environment not found' }, { status: 404 });

    // Duplicate name check (ignore self)
    if (name && name.trim() !== env.name) {
      const dup = await Environment.findOne({
        projectId: env.projectId,
        name: name.trim(),
        _id: { $ne: params.id },
      });
      if (dup) {
        return NextResponse.json(
          { error: `Environment named "${name.trim()}" already exists in this project` },
          { status: 409 }
        );
      }
      env.name = name.trim();
    }

    if (description !== undefined) env.description = description.trim();
    if (color !== undefined) env.color = color;
    if (isGlobal !== undefined) env.isGlobal = Boolean(isGlobal);

    // Variables: merge — preserve secret values for masked variables (value === '')
    if (Array.isArray(variables)) {
      env.variables = mergeVariables(env.variables, variables);
    }

    await env.save();

    return NextResponse.json({
      message: 'Environment updated',
      environment: maskSecrets(env),
    });
  } catch (err) {
    console.error('[PUT /api/environment/:id]', err);
    if (err.code === 11000) {
      return NextResponse.json(
        { error: 'An environment with this name already exists' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE /api/environment/:id ──────────────────────────────────────────────
export async function DELETE(request, { params }) {
  const { error } = await authenticate(request);
  if (error) return error;

  try {
    await connectDB();
    const env = await Environment.findByIdAndDelete(params.id);
    if (!env) return NextResponse.json({ error: 'Environment not found' }, { status: 404 });

    return NextResponse.json({ message: 'Environment deleted', id: params.id });
  } catch (err) {
    console.error('[DELETE /api/environment/:id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Smart merge: if a secret variable comes back with value='' (masked),
 * keep the existing stored value instead of overwriting with empty string.
 */
function mergeVariables(existingVars, incomingVars) {
  return incomingVars
    .filter((v) => v.key && v.key.trim())
    .map((incoming) => {
      const existing = existingVars.find((e) => e.key === incoming.key.trim());

      const isSecret = Boolean(incoming.isSecret);
      // If the variable is secret and the incoming value is empty (masked),
      // preserve the stored secret value
      let value = incoming.value ?? '';
      if (isSecret && value === '' && existing?.isSecret) {
        value = existing.value;
      }

      return {
        key: incoming.key.trim(),
        value,
        description: incoming.description ?? existing?.description ?? '',
        isSecret,
        enabled: incoming.enabled !== false,
      };
    });
}
