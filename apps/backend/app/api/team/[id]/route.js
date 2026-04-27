import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Team from '@/models/Team';
import User from '@/models/User';
import { authenticate } from '@/lib/auth';

// GET /api/team/[id]
export async function GET(request, { params }) {
  const { error, user } = await authenticate(request);
  if (error) return error;

  try {
    await connectDB();
    const team = await Team.findById(params.id)
      .populate('ownerId', 'name email avatar')
      .populate('members.userId', 'name email avatar');

    if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

    const isMember = team.members.some((m) => m.userId._id.toString() === user.id) ||
      team.ownerId._id.toString() === user.id;
    if (!isMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    return NextResponse.json({ team });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/team/[id]
export async function PUT(request, { params }) {
  const { error, user } = await authenticate(request);
  if (error) return error;

  try {
    await connectDB();
    const body = await request.json();
    const team = await Team.findById(params.id);

    if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    if (team.ownerId.toString() !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const updated = await Team.findByIdAndUpdate(params.id, body, { new: true });
    return NextResponse.json({ team: updated });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/team/[id]
export async function DELETE(request, { params }) {
  const { error, user } = await authenticate(request);
  if (error) return error;

  try {
    await connectDB();
    const team = await Team.findById(params.id);
    
    // If not found, still return success (idempotent delete)
    if (!team) {
      return NextResponse.json({ 
        message: 'Team deleted',
        teamId: params.id 
      });
    }
    
    if (team.ownerId.toString() !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await Team.findByIdAndDelete(params.id);
    return NextResponse.json({ 
      message: 'Team deleted',
      teamId: params.id 
    });
  } catch (err) {
    console.error('[DELETE /api/team/:id] Error:', err.message);
    return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 });
  }
}
