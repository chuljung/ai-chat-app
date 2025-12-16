'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PlayIcon, RefreshCwIcon, ChevronDownIcon, ChevronRightIcon } from 'lucide-react'
import type { Resource } from '@modelcontextprotocol/sdk/types.js'

interface ResourcesPanelProps {
    serverId: string
    isConnected: boolean
}

export function ResourcesPanel({ serverId, isConnected }: ResourcesPanelProps) {
    const [resources, setResources] = useState<Resource[]>([])
    const [loading, setLoading] = useState(false)
    const [expandedResource, setExpandedResource] = useState<string | null>(null)
    const [result, setResult] = useState<string | null>(null)
    const [executing, setExecuting] = useState(false)

    const fetchResources = useCallback(async () => {
        if (!isConnected) {
            setResources([])
            return
        }
        setLoading(true)
        try {
            const res = await fetch(`/api/mcp/resources?serverId=${encodeURIComponent(serverId)}`)
            const data = await res.json()
            if (data.resources) {
                setResources(data.resources)
            }
        } catch {
            setResources([])
        } finally {
            setLoading(false)
        }
    }, [serverId, isConnected])

    useEffect(() => {
        fetchResources()
    }, [fetchResources])

    const handleRead = async (uri: string) => {
        setExecuting(true)
        setResult(null)
        try {
            const res = await fetch('/api/mcp/resources/read', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ serverId, uri })
            })
            const data = await res.json()
            if (data.error) {
                setResult(`오류: ${data.error}`)
            } else {
                setResult(JSON.stringify(data.contents, null, 2))
            }
        } catch (err) {
            setResult(`읽기 오류: ${err instanceof Error ? err.message : '알 수 없는 오류'}`)
        } finally {
            setExecuting(false)
        }
    }

    if (!isConnected) {
        return (
            <div className="text-center text-muted-foreground py-8">
                서버에 연결하면 리소스 목록을 볼 수 있습니다.
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-medium">Resources ({resources.length})</h3>
                <Button variant="ghost" size="sm" onClick={fetchResources} disabled={loading}>
                    <RefreshCwIcon className={`size-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
            </div>

            {resources.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    {loading ? '로딩 중...' : '등록된 리소스가 없습니다.'}
                </p>
            ) : (
                <div className="space-y-2">
                    {resources.map(resource => {
                        const isExpanded = expandedResource === resource.uri

                        return (
                            <Card key={resource.uri}>
                                <CardHeader
                                    className="cursor-pointer py-3"
                                    onClick={() => setExpandedResource(isExpanded ? null : resource.uri)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            {isExpanded ? (
                                                <ChevronDownIcon className="size-4" />
                                            ) : (
                                                <ChevronRightIcon className="size-4" />
                                            )}
                                            <CardTitle className="text-sm font-mono">
                                                {resource.name || resource.uri}
                                            </CardTitle>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {resource.mimeType && (
                                                <Badge variant="secondary" className="text-xs">
                                                    {resource.mimeType}
                                                </Badge>
                                            )}
                                            <Badge variant="outline">Resource</Badge>
                                        </div>
                                    </div>
                                    <CardDescription className="text-xs mt-1 ml-6 font-mono">
                                        {resource.uri}
                                    </CardDescription>
                                    {resource.description && (
                                        <CardDescription className="text-xs mt-1 ml-6">
                                            {resource.description}
                                        </CardDescription>
                                    )}
                                </CardHeader>
                                {isExpanded && (
                                    <CardContent className="pt-0 space-y-3">
                                        <Button
                                            size="sm"
                                            onClick={() => handleRead(resource.uri)}
                                            disabled={executing}
                                        >
                                            <PlayIcon className="size-4" />
                                            {executing ? '읽는 중...' : '리소스 읽기'}
                                        </Button>
                                        {result && expandedResource === resource.uri && (
                                            <div className="mt-2">
                                                <Label className="text-xs text-muted-foreground">
                                                    내용
                                                </Label>
                                                <pre className="mt-1 p-3 bg-muted rounded-md text-xs overflow-auto max-h-60">
                                                    {result}
                                                </pre>
                                            </div>
                                        )}
                                    </CardContent>
                                )}
                            </Card>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

