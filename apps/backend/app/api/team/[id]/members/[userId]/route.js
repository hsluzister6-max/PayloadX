import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Team from '@/models/Team';
import { authenticate } from '@/lib/auth';

// DELETE /api/team/[id]/members/[userId]
export async function DELETE(request, { params }) {
  const { error, user } = await authenticate(request);
  if (error) return error;

  try {
    await connectDB();

    const team = await Team.findById(params.id);
    if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

    // Only owner or admins can remove members
    const isAdmin =
      team.ownerId.toString() === user.id ||
      team.members.some((m) => m.userId.toString() === user.id && m.role === 'admin');

    if (!isAdmin)
      return NextResponse.json({ error: 'Only admins can remove members' }, { status: 403 });

    // Cannot remove the owner
    if (team.ownerId.toString() === params.userId)
      return NextResponse.json({ error: 'Cannot remove the team owner' }, { status: 400 });

    const memberExists = team.members.some((m) => m.userId.toString() === params.userId);
    if (!memberExists)
      return NextResponse.json({ error: 'Member not found in team' }, { status: 404 });

    team.members = team.members.filter((m) => m.userId.toString() !== params.userId);
    await team.save();

    // Re-populate for clean response
    const populated = await Team.findById(params.id)
      .populate('ownerId', 'name email avatar')
      .populate('members.userId', 'name email avatar');

    return NextResponse.json({ message: 'Member removed', team: populated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
