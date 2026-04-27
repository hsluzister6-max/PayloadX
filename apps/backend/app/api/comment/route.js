import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Comment from '@/models/Comment';
import { authenticate } from '@/lib/auth';

export async function GET(request) {
  const { error } = await authenticate(request);
  if (error) return error;
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const requestId = searchParams.get('requestId');
    const query = requestId ? { requestId } : {};
    const comments = await Comment.find(query)
      .populate('userId', 'name email avatar')
      .sort({ createdAt: 1 });
    return NextResponse.json({ comments });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  const { error, user } = await authenticate(request);
  if (error) return error;
  try {
    await connectDB();
    const body = await request.json();
    const { requestId, message, parentId } = body;
    if (!requestId || !message) {
      return NextResponse.json({ error: 'requestId and message required' }, { status: 400 });
    }
    const comment = await Comment.create({ requestId, userId: user.id, message, parentId });
    await comment.populate('userId', 'name email avatar');
    return NextResponse.json({ comment }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
