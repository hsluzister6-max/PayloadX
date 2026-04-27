import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import ApiDoc from '@/models/ApiDoc';
import { authenticate } from '@/lib/auth';
import { generateSpec } from '@/lib/swaggerGen';

export async function GET(request, { params }) {
  const { error } = await authenticate(request);
  if (error) return error;

  try {
    await connectDB();
    const { id } = await params;

    const doc = await ApiDoc.findById(id);
    if (!doc) {
      return NextResponse.json({ error: 'ApiDoc not found' }, { status: 404 });
    }

    // Always generate a fresh spec from the current endpoints configuration
    const spec = generateSpec(doc);
    
    // Save to make sure document stays in sync (optional, can be omitted if we only want on-the-fly)
    if (JSON.stringify(doc.spec) !== JSON.stringify(spec)) {
       doc.spec = spec;
       await doc.save();
    }

    return new NextResponse(JSON.stringify(spec, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${doc.name.replace(/\s+/g, '_')}_swagger.json"`,
      },
    });
  } catch (err) {
    console.error('API Doc Export error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
