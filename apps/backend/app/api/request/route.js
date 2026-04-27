import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Request from '@/models/Request';
import User from '@/models/User';
import { authenticate } from '@/lib/auth';

export async function GET(request) {
  const { error } = await authenticate(request);
  if (error) return error;

  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const collectionId = searchParams.get('collectionId');
    const projectId = searchParams.get('projectId');
    const teamId = searchParams.get('teamId');
    const search = searchParams.get('search');

    const query = {};
    if (collectionId) query.collectionId = collectionId;
    if (projectId) query.projectId = projectId;
    if (teamId) query.teamId = teamId;

    if (search) {
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { name: { $regex: safeSearch, $options: 'i' } },
        { url: { $regex: safeSearch, $options: 'i' } }
      ];
    }

    const mQuery = Request.find(query)
      .populate('creatorId', 'name email avatar')
      .sort({ order: 1, createdAt: 1 });

    if (search) mQuery.limit(50); // limit global project searches to top 50 hits

    const requests = await mQuery;
    return NextResponse.json({ requests });
  } catch (err) {
    console.error('[API GET /request] Error:', err.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  const { error, user } = await authenticate(request);
  console.log(user, "user");
  if (error) return error;

  try {
    await connectDB();
    const body = await request.json();
    const { name, method, url, collectionId, projectId, teamId, protocol } = body;

    if (!name || !collectionId || !projectId || !teamId) {
      return NextResponse.json({ error: 'name, collectionId, projectId, teamId required' }, { status: 400 });
    }

    // Default to 'http' if not provided
    const finalProtocol = protocol || 'http';
    console.log(`[API POST] Creating request: "${name}" | Protocol: ${finalProtocol} | Method: ${method || 'N/A'}`);

    // Only set method for HTTP requests. For WS/SIO, don't include method field.
    const methodField = finalProtocol === 'http' ? (method || 'GET') : undefined;

    const createData = {
      ...body,
      name,
      url,
      protocol: finalProtocol,
      collectionId,
      projectId,
      teamId,
      creatorId: user.id,
    };
    
    // Only add method for HTTP requests (WS/Socket.IO don't use HTTP methods)
    if (methodField) {
      createData.method = methodField;
    }
    
    const req = await Request.create(createData);

    // Populate creator before returning
    const populated = await Request.findById(req._id).populate('creatorId', 'name email avatar');

    return NextResponse.json({ request: populated }, { status: 201 });
  } catch (err) {
    console.error('[API POST /request] Error:', err.message);
    if (err.name === 'ValidationError') {
      return NextResponse.json({ error: err.message, details: err.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
