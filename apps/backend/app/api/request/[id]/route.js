import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Request from '@/models/Request';
import { authenticate } from '@/lib/auth';

export async function GET(request, { params }) {
  const { error } = await authenticate(request);
  if (error) return error;

  try {
    await connectDB();
    const req = await Request.findById(params.id).populate('creatorId', 'name email avatar');
    if (!req) return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    return NextResponse.json({ request: req });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const { error } = await authenticate(request);
  if (error) return error;

  try {
    await connectDB();
    const body = await request.json();
    
    // Never allow the frontend to override or change creatorId
    delete body.creatorId;
    
    console.log(`[API PUT] Updating request: ${params.id} | Protocol: ${body.protocol || 'N/A'}`);

    const updated = await Request.findByIdAndUpdate(params.id, body, { new: true, runValidators: true })
      .populate('creatorId', 'name email avatar');
    if (!updated) return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    return NextResponse.json({ request: updated });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { error } = await authenticate(request);
  if (error) return error;

  try {
    await connectDB();
    await Request.findByIdAndDelete(params.id);
    return NextResponse.json({ message: 'Request deleted' });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
