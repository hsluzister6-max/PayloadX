import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Team from '@/models/Team';
import User from '@/models/User';
import { authenticate } from '@/lib/auth';

// POST /api/team/[id]/invite
export async function POST(request, { params }) {
  const { error, user } = await authenticate(request);
  if (error) return error;

  try {
    await connectDB();
    const body = await request.json();
    const { email, role = 'developer' } = body;

    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

    const team = await Team.findById(params.id);
    if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

    const isAdmin = team.members.some(
      (m) => m.userId.toString() === user.id && m.role === 'admin'
    ) || team.ownerId.toString() === user.id;

    if (!isAdmin) return NextResponse.json({ error: 'Only admins can invite members' }, { status: 403 });

    const invitedUser = await User.findOne({ email: email.toLowerCase() });
    if (!invitedUser) return NextResponse.json({ error: 'User not found. They must sign up first.' }, { status: 404 });

    const alreadyMember = team.members.some((m) => m.userId.toString() === invitedUser._id.toString());
    if (alreadyMember) return NextResponse.json({ error: 'User is already a member' }, { status: 409 });

    team.members.push({ userId: invitedUser._id, role });
    await team.save();

    return NextResponse.json({ message: 'Member invited successfully', team });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
