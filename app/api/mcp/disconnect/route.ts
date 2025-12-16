import { NextResponse } from 'next/server'
import mcpClientManager from '@/lib/mcp/client-manager'
import type { MCPDisconnectResponse } from '@/lib/mcp/types'

export const runtime = 'nodejs'

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { serverId } = body as { serverId: string }

        if (!serverId) {
            return NextResponse.json<MCPDisconnectResponse>(
                { success: false, error: 'serverId가 필요합니다.' },
                { status: 400 }
            )
        }

        await mcpClientManager.disconnect(serverId)

        return NextResponse.json<MCPDisconnectResponse>({ success: true })
    } catch (err) {
        const message = err instanceof Error ? err.message : '연결 해제 중 오류가 발생했습니다.'
        return NextResponse.json<MCPDisconnectResponse>(
            { success: false, error: message },
            { status: 500 }
        )
    }
}

