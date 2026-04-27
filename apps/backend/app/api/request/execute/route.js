import { NextResponse } from 'next/server';
import { authenticate } from '@/lib/auth';
import { executeProxiedRequest } from '@/lib/requestProxy';

export const runtime = 'nodejs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: CORS_HEADERS,
  });
}

export async function POST(request) {
  const { error } = await authenticate(request);
  if (error) return error;

  try {
    const payload = await request.json();
    const response = await executeProxiedRequest(payload);

    return NextResponse.json(response, {
      headers: CORS_HEADERS,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || 'Request proxy failed.' },
      {
        status: error?.status || 500,
        headers: CORS_HEADERS,
      }
    );
  }
}
