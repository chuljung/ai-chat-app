import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import type { Tool } from '@modelcontextprotocol/sdk/types.js'

// Tool 실행 결과 타입
export interface ToolCallResult {
    content: Array<{ type: string; text?: string }>
    isError?: boolean
}
import type {
    MCPServerConfig,
    MCPConnectionStatus,
    MCPServerRuntimeState
} from './types'

// Gemini FunctionDeclaration으로 변환된 MCP Tool
export interface MCPToolWithServerId {
    serverId: string
    serverName: string
    tool: Tool
}

interface ManagedClient {
    client: Client
    transport: Transport
    status: MCPConnectionStatus
    error?: string
}

class MCPClientManager {
    private clients: Map<string, ManagedClient> = new Map()

    /**
     * MCP 서버에 연결
     */
    async connect(serverId: string, config: MCPServerConfig): Promise<void> {
        // 이미 연결된 경우 먼저 해제
        if (this.clients.has(serverId)) {
            await this.disconnect(serverId)
        }

        const client = new Client({
            name: 'ai-chat-mcp-client',
            version: '1.0.0'
        })

        let transport: Transport

        try {
            if (config.type === 'stdio') {
                transport = new StdioClientTransport({
                    command: config.command,
                    args: config.args,
                    env: config.env
                })
            } else if (config.type === 'streamable-http') {
                transport = new StreamableHTTPClientTransport(new URL(config.url))
            } else {
                throw new Error(`Unsupported transport type: ${(config as MCPServerConfig).type}`)
            }

            await client.connect(transport)

            this.clients.set(serverId, {
                client,
                transport,
                status: 'connected'
            })
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error'
            this.clients.set(serverId, {
                client,
                transport: transport!,
                status: 'error',
                error: errorMessage
            })
            throw err
        }
    }

    /**
     * MCP 서버 연결 해제
     */
    async disconnect(serverId: string): Promise<void> {
        const managed = this.clients.get(serverId)
        if (!managed) return

        try {
            await managed.client.close()
        } catch {
            // 연결 해제 중 에러는 무시
        } finally {
            this.clients.delete(serverId)
        }
    }

    /**
     * 연결 상태 조회
     */
    getStatus(serverId: string): MCPServerRuntimeState {
        const managed = this.clients.get(serverId)
        if (!managed) {
            return { status: 'disconnected' }
        }
        return {
            status: managed.status,
            error: managed.error
        }
    }

    /**
     * 연결된 클라이언트 반환
     */
    getClient(serverId: string): Client | null {
        const managed = this.clients.get(serverId)
        if (!managed || managed.status !== 'connected') {
            return null
        }
        return managed.client
    }

    /**
     * 서버가 연결되어 있는지 확인
     */
    isConnected(serverId: string): boolean {
        const managed = this.clients.get(serverId)
        return managed?.status === 'connected'
    }

    /**
     * 모든 연결된 서버 ID 목록
     */
    getConnectedServerIds(): string[] {
        return Array.from(this.clients.entries())
            .filter(([, managed]) => managed.status === 'connected')
            .map(([id]) => id)
    }

    /**
     * 모든 서버 상태 조회 (세션 동기화용)
     */
    getAllStatuses(): Record<string, MCPServerRuntimeState> {
        const statuses: Record<string, MCPServerRuntimeState> = {}
        for (const [id, managed] of this.clients.entries()) {
            statuses[id] = {
                status: managed.status,
                error: managed.error
            }
        }
        return statuses
    }

    /**
     * 모든 연결 해제
     */
    async disconnectAll(): Promise<void> {
        const serverIds = Array.from(this.clients.keys())
        await Promise.all(serverIds.map(id => this.disconnect(id)))
    }

    /**
     * 특정 서버의 Tools 목록 조회
     */
    async getTools(serverId: string): Promise<Tool[]> {
        const client = this.getClient(serverId)
        if (!client) return []

        try {
            const result = await client.listTools()
            return result.tools
        } catch {
            return []
        }
    }

    /**
     * 모든 연결된 서버의 Tools 목록 조회 (서버 정보 포함)
     */
    async getAllTools(serverNames?: Record<string, string>): Promise<MCPToolWithServerId[]> {
        const allTools: MCPToolWithServerId[] = []
        const connectedIds = this.getConnectedServerIds()

        for (const serverId of connectedIds) {
            const tools = await this.getTools(serverId)
            for (const tool of tools) {
                allTools.push({
                    serverId,
                    serverName: serverNames?.[serverId] ?? serverId,
                    tool
                })
            }
        }

        return allTools
    }

    /**
     * 특정 서버에서 Tool 실행
     */
    async callTool(
        serverId: string,
        toolName: string,
        args: Record<string, unknown>
    ): Promise<ToolCallResult> {
        const client = this.getClient(serverId)
        if (!client) {
            throw new Error(`서버 ${serverId}가 연결되어 있지 않습니다.`)
        }

        const result = await client.callTool({
            name: toolName,
            arguments: args
        })

        return {
            content: result.content as Array<{ type: string; text?: string }>,
            isError: result.isError === true ? true : undefined
        }
    }
}

// 싱글톤 인스턴스
const globalForMCP = globalThis as unknown as {
    mcpClientManager: MCPClientManager | undefined
}

export const mcpClientManager =
    globalForMCP.mcpClientManager ?? new MCPClientManager()

if (process.env.NODE_ENV !== 'production') {
    globalForMCP.mcpClientManager = mcpClientManager
}

export default mcpClientManager

