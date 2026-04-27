import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Project from '@/models/Project';
import { authenticate } from '@/lib/auth';

export async function GET(request, { params }) {
  const { error, user } = await authenticate(request);
  if (error) return error;

  try {
    await connectDB();
    const project = await Project.findById(params.id)
      .populate('ownerId', 'name email avatar')
      .populate('members.userId', 'name email avatar');

    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    return NextResponse.json({ project });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const { error, user } = await authenticate(request);
  if (error) return error;

  try {
    await connectDB();
    const body = await request.json();
    const project = await Project.findById(params.id);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    
    // Check if user is owner or admin of the project
    const isOwner = project.ownerId.toString() === user.id;
    const isAdmin = project.members?.some(m => 
      m.userId.toString() === user.id && m.role === 'admin'
    );
    
    if (!isOwner && !isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const updated = await Project.findByIdAndUpdate(params.id, body, { new: true });
    return NextResponse.json({ project: updated });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { error, user } = await authenticate(request);
  if (error) return error;

  try {
    await connectDB();
    const project = await Project.findById(params.id);
    
    // If not found, still return success (idempotent delete)
    if (!project) {
      return NextResponse.json({ 
        message: 'Project deleted',
        projectId: params.id 
      });
    }
    
    // Check if user is owner or admin of the project
    const isOwner = project.ownerId.toString() === user.id;
    const isAdmin = project.members?.some(m => 
      m.userId.toString() === user.id && m.role === 'admin'
    );
    
    if (!isOwner && !isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await Project.findByIdAndDelete(params.id);
    return NextResponse.json({ 
      message: 'Project deleted',
      projectId: params.id 
    });
  } catch (err) {
    console.error('[DELETE /api/project/:id] Error:', err.message);
    return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 });
  }
}
