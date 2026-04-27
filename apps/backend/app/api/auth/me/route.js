import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/models/User';
import { authenticate } from '@/lib/auth';

export async function GET(request) {
  const { error, user } = await authenticate(request);
  if (error) return error;

  try {
    await connectDB();
    const fullUser = await User.findById(user.id);
    if (!fullUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    return NextResponse.json({ user: fullUser.toSafeObject() });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request) {
  const { error, user } = await authenticate(request);
  if (error) return error;

  try {
    await connectDB();
    const body = await request.json();
    const { name, avatar } = body;

    const updated = await User.findByIdAndUpdate(
      user.id,
      { ...(name && { name }), ...(avatar !== undefined && { avatar }) },
      { new: true, runValidators: true }
    );

    return NextResponse.json({ user: updated.toSafeObject() });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
