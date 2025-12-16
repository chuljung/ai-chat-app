import { NextResponse } from 'next/server'
import mcpClientManager from '@/lib/mcp/client-manager'
import type { MCPResourceReadResponse } from '@/lib/mcp/types'

export const runtime = 'nodejs'

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { serverId, uri } = body as {
            serverId: string
            uri: string
        }

        if (!serverId || !uri) {
            return NextResponse.json(
                { error: 'serverId와 uri가 필요합니다.' },
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

        const result = await client.readResource({ uri })

        return NextResponse.json<MCPResourceReadResponse>({
            contents: result.contents as MCPResourceReadResponse['contents']
        })
    } catch (err) {
        const message = err instanceof Error ? err.message : '리소스 읽기 중 오류가 발생했습니다.'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}

