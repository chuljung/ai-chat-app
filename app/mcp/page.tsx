'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useMCP } from '@/components/mcp/mcp-provider'
import { ServerList } from '@/components/mcp/server-list'
import { ToolsPanel } from '@/components/mcp/tools-panel'
import { PromptsPanel } from '@/components/mcp/prompts-panel'
import { ResourcesPanel } from '@/components/mcp/resources-panel'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeftIcon, WrenchIcon, MessageSquareIcon, FolderIcon } from 'lucide-react'

export default function MCPPage() {
    const { servers, isLoading } = useMCP()
    const [selectedServerId, setSelectedServerId] = useState<string | null>(null)

    const selectedServer = selectedServerId
        ? servers.find(s => s.id === selectedServerId)
        : null

    const isConnected = selectedServer?.runtime.status === 'connected'

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-muted-foreground">로딩 중...</p>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
            <div className="max-w-7xl mx-auto p-6">
                {/* Header */}
                <header className="flex items-center gap-4 mb-8">
                    <Link
                        href="/"
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ArrowLeftIcon className="size-4" />
                        채팅으로 돌아가기
                    </Link>
                    <div className="flex-1" />
                    <h1 className="text-2xl font-bold tracking-tight">MCP 서버 관리</h1>
                </header>

                <div className="grid lg:grid-cols-[350px_1fr] gap-6">
                    {/* 서버 목록 (좌측) */}
                    <aside className="space-y-4">
                        <ServerList
                            onSelectServer={setSelectedServerId}
                            selectedServerId={selectedServerId}
                        />
                        <p className="text-xs text-muted-foreground px-1">
                            서버 설정은 localStorage에 저장됩니다. 공용 PC에서는 민감정보 입력에 유의하세요.
                        </p>
                    </aside>

                    {/* 상세 패널 (우측) */}
                    <main className="min-h-[500px]">
                        {selectedServer ? (
                            <div className="rounded-xl border bg-card p-6 h-full">
                                <div className="mb-4">
                                    <h2 className="text-lg font-semibold">
                                        {selectedServer.name}
                                    </h2>
                                    <p className="text-sm text-muted-foreground">
                                        {selectedServer.config.type === 'stdio'
                                            ? `STDIO: ${selectedServer.config.command}`
                                            : `HTTP: ${selectedServer.config.url}`}
                                    </p>
                                </div>

                                <Tabs defaultValue="tools" className="flex-1">
                                    <TabsList>
                                        <TabsTrigger value="tools" className="gap-1.5">
                                            <WrenchIcon className="size-4" />
                                            Tools
                                        </TabsTrigger>
                                        <TabsTrigger value="prompts" className="gap-1.5">
                                            <MessageSquareIcon className="size-4" />
                                            Prompts
                                        </TabsTrigger>
                                        <TabsTrigger value="resources" className="gap-1.5">
                                            <FolderIcon className="size-4" />
                                            Resources
                                        </TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="tools" className="mt-4">
                                        <ToolsPanel
                                            serverId={selectedServer.id}
                                            isConnected={isConnected}
                                        />
                                    </TabsContent>

                                    <TabsContent value="prompts" className="mt-4">
                                        <PromptsPanel
                                            serverId={selectedServer.id}
                                            isConnected={isConnected}
                                        />
                                    </TabsContent>

                                    <TabsContent value="resources" className="mt-4">
                                        <ResourcesPanel
                                            serverId={selectedServer.id}
                                            isConnected={isConnected}
                                        />
                                    </TabsContent>
                                </Tabs>
                            </div>
                        ) : (
                            <div className="rounded-xl border bg-card p-6 h-full flex items-center justify-center">
                                <div className="text-center text-muted-foreground">
                                    <p className="text-lg font-medium mb-2">
                                        서버를 선택하세요
                                    </p>
                                    <p className="text-sm">
                                        왼쪽 목록에서 MCP 서버를 선택하면 도구, 프롬프트, 리소스를 확인할 수 있습니다.
                                    </p>
                                </div>
                            </div>
                        )}
                    </main>
                </div>
            </div>
        </div>
    )
}

