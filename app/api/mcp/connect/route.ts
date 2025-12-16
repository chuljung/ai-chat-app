import { NextResponse } from 'next/server'
import mcpClientManager from '@/lib/mcp/client-manager'
import type { MCPServerConfig, MCPConnectResponse } from '@/lib/mcp/types'

export const runtime = 'nodejs'

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { serverId, config } = body as {
            serverId: string
            config: MCPServerConfig
        }

        if (!serverId || !config) {
            return NextResponse.json<MCPConnectResponse>(
                { success: false, error: 'serverId와 config가 필요합니다.' },
                { status: 400 }
            )
        }

        await mcpClientManager.connect(serverId, config)

        return NextResponse.json<MCPConnectResponse>({ success: true })
    } catch (err) {
        const message = err instanceof Error ? err.message : '연결 중 오류가 발생했습니다.'
        return NextResponse.json<MCPConnectResponse>(
            { success: false, error: message },
            { status: 500 }
        )
    }
}

