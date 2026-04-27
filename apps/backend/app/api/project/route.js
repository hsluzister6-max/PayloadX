import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Project from '@/models/Project';
import Team from '@/models/Team';
import User from '@/models/User';
import { authenticate } from '@/lib/auth';

// GET /api/project?teamId=xxx
export async function GET(request) {
  const { error, user } = await authenticate(request);
  if (error) return error;

  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');

    let query;

    if (teamId) {
      // Verify the requesting user is actually a member (or owner) of this team
      const team = await Team.findById(teamId);
      if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

      const isMember =
        team.ownerId.toString() === user.id ||
        team.members.some((m) => m.userId.toString() === user.id);

      if (!isMember) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      // Return ALL projects that belong to this team — every team member can see them
      query = { teamId };
    } else {
      // No teamId supplied — fall back to personal scope
      query = { $or: [{ ownerId: user.id }, { 'members.userId': user.id }] };
    }

    const projects = await Project.find(query)
      .populate('ownerId', 'name email avatar')
      .sort({ updatedAt: -1 });

    return NextResponse.json({ projects });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/project
export async function POST(request) {
  const { error, user } = await authenticate(request);
  if (error) return error;

  try {
    await connectDB();
    const body = await request.json();
    const { name, teamId, description, visibility = 'team', color } = body;

    if (!name || !teamId) {
      return NextResponse.json({ error: 'Name and teamId are required' }, { status: 400 });
    }

    const team = await Team.findById(teamId);
    if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

    const project = await Project.create({
      name,
      teamId,
      ownerId: user.id,
      description,
      visibility,
      color,
      members: [{ userId: user.id, role: 'admin' }],
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
