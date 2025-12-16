import type { MCPServerDefinition, MCPExportData } from './types'

const STORAGE_KEY = 'mcp:servers:v1'
const EXPORT_VERSION = '1.0.0'

/**
 * 모든 MCP 서버 정의 로드
 */
export function loadServers(): MCPServerDefinition[] {
    if (typeof window === 'undefined') return []

    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return []
        return JSON.parse(raw) as MCPServerDefinition[]
    } catch {
        return []
    }
}

/**
 * MCP 서버 정의 저장
 */
export function saveServers(servers: MCPServerDefinition[]): void {
    if (typeof window === 'undefined') return

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(servers))
    } catch {
        console.error('Failed to save MCP servers to localStorage')
    }
}

/**
 * 새 서버 추가
 */
export function addServer(
    server: Omit<MCPServerDefinition, 'id' | 'createdAt' | 'updatedAt'>
): MCPServerDefinition {
    const servers = loadServers()
    const now = Date.now()
    const newServer: MCPServerDefinition = {
        ...server,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now
    }
    servers.push(newServer)
    saveServers(servers)
    return newServer
}

/**
 * 서버 업데이트
 */
export function updateServer(
    id: string,
    updates: Partial<Omit<MCPServerDefinition, 'id' | 'createdAt'>>
): MCPServerDefinition | null {
    const servers = loadServers()
    const index = servers.findIndex(s => s.id === id)
    if (index === -1) return null

    servers[index] = {
        ...servers[index],
        ...updates,
        updatedAt: Date.now()
    }
    saveServers(servers)
    return servers[index]
}

/**
 * 서버 삭제
 */
export function deleteServer(id: string): boolean {
    const servers = loadServers()
    const filtered = servers.filter(s => s.id !== id)
    if (filtered.length === servers.length) return false
    saveServers(filtered)
    return true
}

/**
 * ID로 서버 조회
 */
export function getServerById(id: string): MCPServerDefinition | null {
    const servers = loadServers()
    return servers.find(s => s.id === id) ?? null
}

/**
 * 설정 내보내기 (JSON 문자열 반환)
 */
export function exportServers(): string {
    const servers = loadServers()
    const exportData: MCPExportData = {
        version: EXPORT_VERSION,
        exportedAt: Date.now(),
        servers
    }
    return JSON.stringify(exportData, null, 2)
}

/**
 * 설정 가져오기
 * @param json - 내보낸 JSON 문자열
 * @param mode - 'replace': 기존 설정 대체, 'merge': 기존 설정에 병합
 */
export function importServers(
    json: string,
    mode: 'replace' | 'merge' = 'merge'
): { success: boolean; imported: number; error?: string } {
    try {
        const data = JSON.parse(json) as MCPExportData

        // 버전 검증
        if (!data.version || !data.servers || !Array.isArray(data.servers)) {
            return { success: false, imported: 0, error: '잘못된 형식의 파일입니다.' }
        }

        const now = Date.now()
        const importedServers = data.servers.map(server => ({
            ...server,
            id: crypto.randomUUID(), // 새 ID 할당
            createdAt: now,
            updatedAt: now
        }))

        if (mode === 'replace') {
            saveServers(importedServers)
        } else {
            const existing = loadServers()
            saveServers([...existing, ...importedServers])
        }

        return { success: true, imported: importedServers.length }
    } catch {
        return { success: false, imported: 0, error: 'JSON 파싱에 실패했습니다.' }
    }
}

/**
 * 모든 서버 설정 삭제
 */
export function clearAllServers(): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem(STORAGE_KEY)
}

