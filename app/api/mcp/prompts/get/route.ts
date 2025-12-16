import { NextResponse } from 'next/server'
import mcpClientManager from '@/lib/mcp/client-manager'
import type { MCPPromptGetResponse } from '@/lib/mcp/types'

export const runtime = 'nodejs'

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { serverId, name, arguments: args } = body as {
            serverId: string
            name: string
            arguments?: Record<string, string>
        }

        if (!serverId || !name) {
            return NextResponse.json(
                { error: 'serverId와 name이 필요합니다.' },
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

        const result = await client.getPrompt({
            name,
            arguments: args
        })

        return NextResponse.json<MCPPromptGetResponse>({
            description: result.description,
            messages: result.messages as MCPPromptGetResponse['messages']
        })
    } catch (err) {
        const message = err instanceof Error ? err.message : '프롬프트 조회 중 오류가 발생했습니다.'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}

