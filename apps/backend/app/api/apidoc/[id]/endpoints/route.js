import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import ApiDoc from '@/models/ApiDoc';
import { authenticate } from '@/lib/auth';
import { generateSpec } from '@/lib/swaggerGen';

export async function POST(request, { params }) {
  const { error } = await authenticate(request);
  if (error) return error;

  try {
    await connectDB();
    const { id } = await params;
    const { endpoint } = await request.json();

    if (!endpoint || !endpoint.id) {
      return NextResponse.json({ error: 'Endpoint object with id is required' }, { status: 400 });
    }

    const doc = await ApiDoc.findById(id);
    if (!doc) {
      return NextResponse.json({ error: 'ApiDoc not found' }, { status: 404 });
    }

    doc.endpoints.push(endpoint);
    doc.spec = generateSpec(doc); // Auto-update swagger spec
    await doc.save();

    return NextResponse.json({ doc });
  } catch (err) {
    console.error('Endpoint POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const { error } = await authenticate(request);
  if (error) return error;

  try {
    await connectDB();
    const { id } = await params;
    const { endpoint } = await request.json();

    if (!endpoint || !endpoint.id) {
      return NextResponse.json({ error: 'Endpoint object with id is required' }, { status: 400 });
    }

    const doc = await ApiDoc.findById(id);
    if (!doc) {
      return NextResponse.json({ error: 'ApiDoc not found' }, { status: 404 });
    }

    const index = doc.endpoints.findIndex((e) => e.id === endpoint.id);
    if (index === -1) {
      return NextResponse.json({ error: 'Endpoint not found in doc' }, { status: 404 });
    }

    doc.endpoints[index] = endpoint;
    doc.spec = generateSpec(doc); // Auto-update swagger spec
    await doc.save();

    return NextResponse.json({ doc });
  } catch (err) {
    console.error('Endpoint PUT error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { error } = await authenticate(request);
  if (error) return error;

  try {
    await connectDB();
    const { id } = await params;
    
    const { searchParams } = new URL(request.url);
    const endpointId = searchParams.get('endpointId');

    if (!endpointId) {
      return NextResponse.json({ error: 'endpointId query param is required' }, { status: 400 });
    }

    const doc = await ApiDoc.findById(id);
    if (!doc) {
      return NextResponse.json({ error: 'ApiDoc not found' }, { status: 404 });
    }

    doc.endpoints = doc.endpoints.filter((e) => e.id !== endpointId);
    doc.spec = generateSpec(doc); // Auto-update swagger spec
    await doc.save();

    return NextResponse.json({ doc });
  } catch (err) {
    console.error('Endpoint DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
