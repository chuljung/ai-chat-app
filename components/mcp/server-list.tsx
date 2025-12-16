'use client'

import { useState } from 'react'
import { useMCP } from './mcp-provider'
import { ServerForm } from './server-form'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
    PlusIcon,
    PlayIcon,
    StopCircleIcon,
    PencilIcon,
    TrashIcon,
    TerminalIcon,
    GlobeIcon,
    DownloadIcon,
    UploadIcon
} from 'lucide-react'
import type { MCPServerDefinition, MCPServerConfig, MCPConnectionStatus } from '@/lib/mcp/types'

interface ServerListProps {
    onSelectServer: (serverId: string | null) => void
    selectedServerId: string | null
}

const statusColors: Record<MCPConnectionStatus, string> = {
    disconnected: 'bg-gray-500',
    connecting: 'bg-yellow-500 animate-pulse',
    connected: 'bg-green-500',
    error: 'bg-red-500'
}

const statusLabels: Record<MCPConnectionStatus, string> = {
    disconnected: '연결 안됨',
    connecting: '연결 중...',
    connected: '연결됨',
    error: '오류'
}

export function ServerList({ onSelectServer, selectedServerId }: ServerListProps) {
    const {
        servers,
        addServer,
        updateServer,
        deleteServer,
        connect,
        disconnect,
        exportConfig,
        importConfig
    } = useMCP()

    const [formOpen, setFormOpen] = useState(false)
    const [editingServer, setEditingServer] = useState<MCPServerDefinition | null>(null)

    const handleAddClick = () => {
        setEditingServer(null)
        setFormOpen(true)
    }

    const handleEditClick = (server: MCPServerDefinition) => {
        setEditingServer(server)
        setFormOpen(true)
    }

    const handleFormSubmit = (name: string, config: MCPServerConfig) => {
        if (editingServer) {
            updateServer(editingServer.id, name, config)
        } else {
            addServer(name, config)
        }
    }

    const handleDeleteClick = async (serverId: string) => {
        if (confirm('이 서버를 삭제하시겠습니까?')) {
            await deleteServer(serverId)
            if (selectedServerId === serverId) {
                onSelectServer(null)
            }
        }
    }

    const handleExport = () => {
        const json = exportConfig()
        const blob = new Blob([json], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `mcp-servers-${new Date().toISOString().slice(0, 10)}.json`
        a.click()
        URL.revokeObjectURL(url)
    }

    const handleImport = () => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.json'
        input.onchange = async e => {
            const file = (e.target as HTMLInputElement).files?.[0]
            if (!file) return
            const text = await file.text()
            const result = importConfig(text, 'merge')
            if (result.success) {
                alert(`${result.imported}개의 서버를 가져왔습니다.`)
            } else {
                alert(`가져오기 실패: ${result.error}`)
            }
        }
        input.click()
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">MCP 서버 목록</h2>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleImport}>
                        <UploadIcon className="size-4" />
                        가져오기
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExport}>
                        <DownloadIcon className="size-4" />
                        내보내기
                    </Button>
                    <Button size="sm" onClick={handleAddClick}>
                        <PlusIcon className="size-4" />
                        서버 추가
                    </Button>
                </div>
            </div>

            {servers.length === 0 ? (
                <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                        등록된 MCP 서버가 없습니다. 서버를 추가해주세요.
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-3">
                    {servers.map(server => {
                        const isSelected = selectedServerId === server.id
                        const isConnected = server.runtime.status === 'connected'
                        const isConnecting = server.runtime.status === 'connecting'

                        return (
                            <Card
                                key={server.id}
                                className={`cursor-pointer transition-colors ${
                                    isSelected
                                        ? 'ring-2 ring-primary'
                                        : 'hover:bg-accent/50'
                                }`}
                                onClick={() => onSelectServer(server.id)}
                            >
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            {server.config.type === 'stdio' ? (
                                                <TerminalIcon className="size-5 text-muted-foreground" />
                                            ) : (
                                                <GlobeIcon className="size-5 text-muted-foreground" />
                                            )}
                                            <div>
                                                <CardTitle className="text-base">
                                                    {server.name}
                                                </CardTitle>
                                                <CardDescription className="text-xs">
                                                    {server.config.type === 'stdio'
                                                        ? `${server.config.command} ${server.config.args?.join(' ') ?? ''}`
                                                        : server.config.url}
                                                </CardDescription>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge
                                                variant="outline"
                                                className="gap-1.5"
                                            >
                                                <span
                                                    className={`size-2 rounded-full ${statusColors[server.runtime.status]}`}
                                                />
                                                {statusLabels[server.runtime.status]}
                                            </Badge>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-0">
                                    <div className="flex items-center justify-end gap-1">
                                        {isConnected ? (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={e => {
                                                    e.stopPropagation()
                                                    disconnect(server.id)
                                                }}
                                            >
                                                <StopCircleIcon className="size-4" />
                                                연결 해제
                                            </Button>
                                        ) : (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={e => {
                                                    e.stopPropagation()
                                                    connect(server.id)
                                                }}
                                                disabled={isConnecting}
                                            >
                                                <PlayIcon className="size-4" />
                                                {isConnecting ? '연결 중...' : '연결'}
                                            </Button>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={e => {
                                                e.stopPropagation()
                                                handleEditClick(server)
                                            }}
                                        >
                                            <PencilIcon className="size-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={e => {
                                                e.stopPropagation()
                                                handleDeleteClick(server.id)
                                            }}
                                        >
                                            <TrashIcon className="size-4 text-destructive" />
                                        </Button>
                                    </div>
                                    {server.runtime.error && (
                                        <p className="mt-2 text-xs text-destructive">
                                            {server.runtime.error}
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}

            <ServerForm
                open={formOpen}
                onOpenChange={setFormOpen}
                server={editingServer}
                onSubmit={handleFormSubmit}
            />
        </div>
    )
}

