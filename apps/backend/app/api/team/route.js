import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Team from '@/models/Team';
import { authenticate } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

// GET /api/team — list user's teams
export async function GET(request) {
  const { error, user } = await authenticate(request);
  if (error) return error;

  try {
    await connectDB();
    const teams = await Team.find({
      $or: [{ ownerId: user.id }, { 'members.userId': user.id }],
    }).populate('ownerId', 'name email avatar');

    return NextResponse.json({ teams });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/team — create team
export async function POST(request) {
  const { error, user } = await authenticate(request);
  if (error) return error;

  try {
    await connectDB();
    const body = await request.json();
    const { name, description } = body;

    if (!name) return NextResponse.json({ error: 'Team name is required' }, { status: 400 });

    const team = await Team.create({
      name,
      description,
      ownerId: user.id,
      members: [{ userId: user.id, role: 'admin' }],
      inviteToken: uuidv4(),
    });

    return NextResponse.json({ team }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
