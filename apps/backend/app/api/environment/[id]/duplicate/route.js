import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Environment, { maskSecrets } from '@/models/Environment';
import { authenticate } from '@/lib/auth';

// POST /api/environment/:id/duplicate
// Creates a copy of the environment with "(Copy)" suffix
export async function POST(request, { params }) {
  const { error, user } = await authenticate(request);
  if (error) return error;

  try {
    await connectDB();
    const source = await Environment.findById(params.id);
    if (!source) return NextResponse.json({ error: 'Environment not found' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const newName = body.name || `${source.name} (Copy)`;

    // Ensure unique name
    let finalName = newName;
    let i = 2;
    while (await Environment.findOne({ projectId: source.projectId, name: finalName })) {
      finalName = `${newName} ${i++}`;
    }

    const copy = await Environment.create({
      name: finalName,
      description: source.description,
      projectId: source.projectId,
      teamId: source.teamId,
      createdBy: user.id,
      color: source.color,
      isGlobal: false,
      // Deep copy variables but clear secret values
      variables: source.variables.map((v) => ({
        key: v.key,
        value: v.isSecret ? '' : v.value,
        description: v.description,
        isSecret: v.isSecret,
        enabled: v.enabled,
      })),
    });

    return NextResponse.json(
      { message: 'Environment duplicated', environment: maskSecrets(copy) },
      { status: 201 }
    );
  } catch (err) {
    console.error('[POST /api/environment/:id/duplicate]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
