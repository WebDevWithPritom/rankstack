import { NextRequest, NextResponse } from 'next/server';
import * as store from '@/lib/store';
import { Integration } from '@/lib/types';
import { encrypt } from '@/lib/crypto';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const integrations = await store.getIntegrations(projectId);
    
    // For security, do not return actual tokens/keys directly to client UI.
    // Return placeholder indicating configured state.
    const safeIntegrations = integrations.map(i => ({
      project_id: i.project_id,
      type: i.type,
      is_active: i.is_active,
      has_credentials: !!(i.api_key || i.metadata)
    }));

    return NextResponse.json(safeIntegrations);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { project_id, type, is_active, api_key, metadata } = body;

    if (!project_id || !type) {
      return NextResponse.json({ error: 'Project ID and Type are required' }, { status: 400 });
    }

    const integration: Integration = {
      project_id,
      type,
      is_active: is_active !== undefined ? is_active : true
    };

    if (api_key) {
      integration.api_key = encrypt(api_key);
    }

    if (metadata) {
      const metadataStr = typeof metadata === 'string' ? metadata : JSON.stringify(metadata);
      integration.metadata = encrypt(metadataStr);
    }

    const saved = await store.saveIntegration(integration);
    return NextResponse.json({
      project_id: saved.project_id,
      type: saved.type,
      is_active: saved.is_active,
      has_credentials: true
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const type = searchParams.get('type') as 'gsc' | 'serpapi' | 'dataforseo' | null;

    if (!projectId || !type) {
      return NextResponse.json({ error: 'Project ID and Type are required' }, { status: 400 });
    }

    await store.deleteIntegration(projectId, type);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
