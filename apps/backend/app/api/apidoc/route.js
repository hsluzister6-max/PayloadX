import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import ApiDoc from '@/models/ApiDoc';
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
    if (teamId)    query.teamId = teamId;

    // We don't need to load all endpoints for the list view, just summary info
    const docs = await ApiDoc.find(query)
      .select('name description version baseUrl projectId teamId createdAt updatedAt')
      .populate('createdBy', 'name email avatar')
      .sort({ updatedAt: -1 });

    return NextResponse.json({ docs });
  } catch (err) {
    console.error('API Doc GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  const { error, user } = await authenticate(request);
  if (error) return error;

  try {
    await connectDB();
    const body = await request.json();
    const { name, projectId, teamId, description, version, baseUrl } = body;

    if (!name || !projectId || !teamId) {
      return NextResponse.json({ error: 'name, projectId and teamId are required' }, { status: 400 });
    }

    const doc = await ApiDoc.create({
      name,
      projectId,
      teamId,
      createdBy: user.id,
      description,
      version: version || '1.0.0',
      baseUrl: baseUrl || '',
      endpoints: [],
    });

    // Populate createdBy before returning
    await doc.populate('createdBy', 'name email avatar');

    return NextResponse.json({ doc }, { status: 201 });
  } catch (err) {
    console.error('API Doc POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
