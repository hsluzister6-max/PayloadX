import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import ApiDoc from '@/models/ApiDoc';
import { authenticate } from '@/lib/auth';

export async function GET(request, { params }) {
  const { error } = await authenticate(request);
  if (error) return error;

  try {
    await connectDB();
    const { id } = await params;

    const doc = await ApiDoc.findById(id).populate('createdBy', 'name email avatar');
    if (!doc) {
      return NextResponse.json({ error: 'ApiDoc not found' }, { status: 404 });
    }

    return NextResponse.json({ doc });
  } catch (err) {
    console.error('API Doc GET [id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const { error } = await authenticate(request);
  if (error) return error;

  try {
    await connectDB();
    const { id } = await params;
    const body = await request.json();

    const doc = await ApiDoc.findById(id);
    if (!doc) {
      return NextResponse.json({ error: 'ApiDoc not found' }, { status: 404 });
    }

    if (body.name !== undefined) doc.name = body.name;
    if (body.description !== undefined) doc.description = body.description;
    if (body.version !== undefined) doc.version = body.version;
    if (body.baseUrl !== undefined) doc.baseUrl = body.baseUrl;

    await doc.save();
    return NextResponse.json({ doc });
  } catch (err) {
    console.error('API Doc PUT [id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { error } = await authenticate(request);
  if (error) return error;

  try {
    await connectDB();
    const { id } = await params;

    const doc = await ApiDoc.findByIdAndDelete(id);
    if (!doc) {
      return NextResponse.json({ error: 'ApiDoc not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('API Doc DELETE [id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
