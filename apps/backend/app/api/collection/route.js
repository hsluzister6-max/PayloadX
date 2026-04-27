import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Collection from '@/models/Collection';
import { authenticate } from '@/lib/auth';

export async function GET(request) {
  const { error, user } = await authenticate(request);
  if (error) return error;

  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const teamId = searchParams.get('teamId');

    const query = {};
    if (projectId) query.projectId = projectId;
    if (teamId) query.teamId = teamId;

    const collections = await Collection.find(query)
      .populate('createdBy', 'name email avatar')
      .sort({ updatedAt: -1 });

    return NextResponse.json({ collections });
  } catch (err) {
    console.error('[GET /api/collection] Error:', err.message, err.stack);
    return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const { error, user } = await authenticate(request);
  if (error) return error;

  try {
    await connectDB();
    const body = await request.json();
    const { name, projectId, teamId, description } = body;

    if (!name || !projectId || !teamId) {
      return NextResponse.json({ error: 'name, projectId and teamId are required' }, { status: 400 });
    }

    const collection = await Collection.create({
      name,
      projectId,
      teamId,
      createdBy: user.id,
      description,
    });

    return NextResponse.json({ collection }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/collection] Error:', err.message);
    return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 });
  }
}
