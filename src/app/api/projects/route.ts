import { NextRequest, NextResponse } from 'next/server';
import * as store from '@/lib/store';
import { Project } from '@/lib/types';

export async function GET() {
  try {
    const projects = await store.getProjects();
    return NextResponse.json(projects);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, domain } = body;

    if (!name || !domain) {
      return NextResponse.json({ error: 'Name and Domain are required' }, { status: 400 });
    }

    // Normalize domain URL format
    let cleanDomain = domain.trim();
    if (!cleanDomain.startsWith('http://') && !cleanDomain.startsWith('https://') && !cleanDomain.startsWith('sc-domain:')) {
      cleanDomain = `https://${cleanDomain}`;
    }
    // Ensure trailing slash for site URL if it's a standard URL
    if (cleanDomain.startsWith('http') && !cleanDomain.endsWith('/')) {
      cleanDomain = `${cleanDomain}/`;
    }

    const newProject: Project = {
      id: `proj_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`,
      name: name.trim(),
      domain: cleanDomain,
      created_at: new Date().toISOString()
    };

    const created = await store.createProject(newProject);
    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    await store.deleteProject(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
