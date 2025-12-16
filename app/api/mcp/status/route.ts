import { NextResponse } from 'next/server'
import mcpClientManager from '@/lib/mcp/client-manager'
import type { MCPStatusResponse, MCPAllStatusesResponse } from '@/lib/mcp/types'

export const runtime = 'nodejs'

export async function GET(req: Request) {
    const url = new URL(req.url)
    const serverId = url.searchParams.get('serverId')

    // serverId가 없으면 모든 서버 상태 반환 (세션 동기화용)
    if (!serverId) {
        const statuses = mcpClientManager.getAllStatuses()
        return NextResponse.json<MCPAllStatusesResponse>({ statuses })
    }

    const state = mcpClientManager.getStatus(serverId)

    return NextResponse.json<MCPStatusResponse>({
        status: state.status,
        error: state.error
    })
}

