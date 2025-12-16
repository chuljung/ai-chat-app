'use client'

import {
    createContext,
    useContext,
    useCallback,
    useEffect,
    useState,
    useMemo,
    type ReactNode
} from 'react'
import type {
    MCPServerDefinition,
    MCPServerState,
    MCPServerConfig,
    MCPConnectionStatus,
    MCPServerRuntimeState,
    MCPAllStatusesResponse
} from '@/lib/mcp/types'
import {
    loadServers,
    saveServers,
    addServer as storageAddServer,
    updateServer as storageUpdateServer,
    deleteServer as storageDeleteServer,
    exportServers,
    importServers
} from '@/lib/mcp/storage'

interface MCPContextValue {
    // 서버 목록
    servers: MCPServerState[]
    // 서버 관리
    addServer: (name: string, config: MCPServerConfig) => MCPServerDefinition
    updateServer: (id: string, name: string, config: MCPServerConfig) => void
    deleteServer: (id: string) => Promise<void>
    // 연결 관리
    connect: (serverId: string) => Promise<void>
    disconnect: (serverId: string) => Promise<void>
    // 상태 동기화
    refreshServerStatus: (serverId: string) => Promise<void>
    // 내보내기/가져오기
    exportConfig: () => string
    importConfig: (json: string, mode: 'replace' | 'merge') => { success: boolean; imported: number; error?: string }
    // 로딩 상태
    isLoading: boolean
}

const MCPContext = createContext<MCPContextValue | null>(null)

export function useMCP() {
    const context = useContext(MCPContext)
    if (!context) {
        throw new Error('useMCP must be used within MCPProvider')
    }
    return context
}

interface MCPProviderProps {
    children: ReactNode
}

export function MCPProvider({ children }: MCPProviderProps) {
    const [serverDefinitions, setServerDefinitions] = useState<MCPServerDefinition[]>([])
    const [runtimeStates, setRuntimeStates] = useState<Map<string, { status: MCPConnectionStatus; error?: string }>>(
        new Map()
    )
    const [isLoading, setIsLoading] = useState(true)

    // 초기 로드 및 서버 상태 동기화
    useEffect(() => {
        const initializeState = async () => {
            const loaded = loadServers()
            setServerDefinitions(loaded)

            // 서버측에서 현재 연결 상태 동기화
            try {
                const res = await fetch('/api/mcp/status')
                const data = (await res.json()) as MCPAllStatusesResponse
                
                if (data.statuses) {
                    const newStates = new Map<string, { status: MCPConnectionStatus; error?: string }>()
                    
                    // 서버에서 연결된 상태 적용
                    for (const [serverId, state] of Object.entries(data.statuses)) {
                        newStates.set(serverId, state as MCPServerRuntimeState)
                    }
                    
                    setRuntimeStates(newStates)
                }
            } catch {
                // 서버 상태 조회 실패 시 기본값 유지
            }

            setIsLoading(false)
        }

        initializeState()
    }, [])

    // 서버 정의 변경 시 localStorage에 저장
    useEffect(() => {
        if (!isLoading) {
            saveServers(serverDefinitions)
        }
    }, [serverDefinitions, isLoading])

    // 서버 상태 조회
    const refreshServerStatus = useCallback(async (serverId: string) => {
        try {
            const res = await fetch(`/api/mcp/status?serverId=${encodeURIComponent(serverId)}`)
            const data = await res.json()
            setRuntimeStates(prev => {
                const next = new Map(prev)
                next.set(serverId, { status: data.status, error: data.error })
                return next
            })
        } catch {
            setRuntimeStates(prev => {
                const next = new Map(prev)
                next.set(serverId, { status: 'error', error: '상태 조회 실패' })
                return next
            })
        }
    }, [])

    // 서버 추가
    const addServer = useCallback((name: string, config: MCPServerConfig) => {
        const newServer = storageAddServer({ name, config })
        setServerDefinitions(prev => [...prev, newServer])
        setRuntimeStates(prev => {
            const next = new Map(prev)
            next.set(newServer.id, { status: 'disconnected' })
            return next
        })
        return newServer
    }, [])

    // 서버 업데이트
    const updateServer = useCallback((id: string, name: string, config: MCPServerConfig) => {
        const updated = storageUpdateServer(id, { name, config })
        if (updated) {
            setServerDefinitions(prev => prev.map(s => (s.id === id ? updated : s)))
        }
    }, [])

    // 서버 삭제
    const deleteServer = useCallback(async (id: string) => {
        // 연결된 경우 먼저 해제
        const state = runtimeStates.get(id)
        if (state?.status === 'connected') {
            try {
                await fetch('/api/mcp/disconnect', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ serverId: id })
                })
            } catch {
                // 에러 무시
            }
        }

        storageDeleteServer(id)
        setServerDefinitions(prev => prev.filter(s => s.id !== id))
        setRuntimeStates(prev => {
            const next = new Map(prev)
            next.delete(id)
            return next
        })
    }, [runtimeStates])

    // 서버 연결
    const connect = useCallback(async (serverId: string) => {
        const server = serverDefinitions.find(s => s.id === serverId)
        if (!server) return

        setRuntimeStates(prev => {
            const next = new Map(prev)
            next.set(serverId, { status: 'connecting' })
            return next
        })

        try {
            const res = await fetch('/api/mcp/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ serverId, config: server.config })
            })
            const data = await res.json()

            if (data.success) {
                setRuntimeStates(prev => {
                    const next = new Map(prev)
                    next.set(serverId, { status: 'connected' })
                    return next
                })
            } else {
                setRuntimeStates(prev => {
                    const next = new Map(prev)
                    next.set(serverId, { status: 'error', error: data.error })
                    return next
                })
            }
        } catch (err) {
            setRuntimeStates(prev => {
                const next = new Map(prev)
                next.set(serverId, {
                    status: 'error',
                    error: err instanceof Error ? err.message : '연결 실패'
                })
                return next
            })
        }
    }, [serverDefinitions])

    // 서버 연결 해제
    const disconnect = useCallback(async (serverId: string) => {
        try {
            await fetch('/api/mcp/disconnect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ serverId })
            })
        } catch {
            // 에러 무시
        }

        setRuntimeStates(prev => {
            const next = new Map(prev)
            next.set(serverId, { status: 'disconnected' })
            return next
        })
    }, [])

    // 설정 내보내기
    const exportConfig = useCallback(() => {
        return exportServers()
    }, [])

    // 설정 가져오기
    const importConfig = useCallback((json: string, mode: 'replace' | 'merge') => {
        const result = importServers(json, mode)
        if (result.success) {
            const loaded = loadServers()
            setServerDefinitions(loaded)
        }
        return result
    }, [])

    // 서버 상태 결합
    const servers = useMemo<MCPServerState[]>(() => {
        return serverDefinitions.map(def => ({
            ...def,
            runtime: runtimeStates.get(def.id) ?? { status: 'disconnected' }
        }))
    }, [serverDefinitions, runtimeStates])

    const value = useMemo<MCPContextValue>(
        () => ({
            servers,
            addServer,
            updateServer,
            deleteServer,
            connect,
            disconnect,
            refreshServerStatus,
            exportConfig,
            importConfig,
            isLoading
        }),
        [
            servers,
            addServer,
            updateServer,
            deleteServer,
            connect,
            disconnect,
            refreshServerStatus,
            exportConfig,
            importConfig,
            isLoading
        ]
    )

    return <MCPContext.Provider value={value}>{children}</MCPContext.Provider>
}

