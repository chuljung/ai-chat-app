import type { Tool, Prompt, Resource } from '@modelcontextprotocol/sdk/types.js'

// MCP 서버 연결 타입
export type MCPTransportType = 'stdio' | 'streamable-http'

// STDIO 서버 설정
export interface StdioServerConfig {
    type: 'stdio'
    command: string
    args?: string[]
    env?: Record<string, string>
}

// Streamable HTTP 서버 설정
export interface StreamableHttpServerConfig {
    type: 'streamable-http'
    url: string
}

// MCP 서버 설정 (Union)
export type MCPServerConfig = StdioServerConfig | StreamableHttpServerConfig

// 연결 상태
export type MCPConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

// MCP 서버 정의 (localStorage에 저장되는 형태)
export interface MCPServerDefinition {
    id: string
    name: string
    config: MCPServerConfig
    createdAt: number
    updatedAt: number
}

// MCP 서버 런타임 상태
export interface MCPServerRuntimeState {
    status: MCPConnectionStatus
    error?: string
    tools?: Tool[]
    prompts?: Prompt[]
    resources?: Resource[]
}

// MCP 서버 전체 상태 (정의 + 런타임 상태)
export interface MCPServerState extends MCPServerDefinition {
    runtime: MCPServerRuntimeState
}

// API 응답 타입들
export interface MCPConnectResponse {
    success: boolean
    error?: string
}

export interface MCPDisconnectResponse {
    success: boolean
    error?: string
}

export interface MCPStatusResponse {
    status: MCPConnectionStatus
    error?: string
}

// 모든 서버 상태 응답 (세션 동기화용)
export interface MCPAllStatusesResponse {
    statuses: Record<string, MCPServerRuntimeState>
}

export interface MCPToolsResponse {
    tools: Tool[]
}

export interface MCPToolCallResponse {
    content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>
    isError?: boolean
}

export interface MCPPromptsResponse {
    prompts: Prompt[]
}

export interface MCPPromptGetResponse {
    description?: string
    messages: Array<{
        role: 'user' | 'assistant'
        content: { type: string; text?: string }
    }>
}

export interface MCPResourcesResponse {
    resources: Resource[]
}

export interface MCPResourceReadResponse {
    contents: Array<{ uri: string; mimeType?: string; text?: string; blob?: string }>
}

// 내보내기/가져오기용 설정 형식
export interface MCPExportData {
    version: string
    exportedAt: number
    servers: MCPServerDefinition[]
}

