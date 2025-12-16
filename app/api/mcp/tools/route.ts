import { NextResponse } from 'next/server'
import mcpClientManager from '@/lib/mcp/client-manager'
import type { MCPToolsResponse } from '@/lib/mcp/types'

export const runtime = 'nodejs'

export async function GET(req: Request) {
    const url = new URL(req.url)
    const serverId = url.searchParams.get('serverId')

    if (!serverId) {
        return NextResponse.json(
            { error: 'serverId가 필요합니다.' },
            { status: 400 }
        )
    }

    const client = mcpClientManager.getClient(serverId)
    if (!client) {
        return NextResponse.json(
            { error: '서버가 연결되어 있지 않습니다.' },
            { status: 400 }
        )
    }

    try {
        const result = await client.listTools()
        return NextResponse.json<MCPToolsResponse>({
            tools: result.tools
        })
    } catch (err) {
        const message = err instanceof Error ? err.message : '도구 목록 조회 중 오류가 발생했습니다.'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}

