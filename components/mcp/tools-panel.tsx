'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PlayIcon, RefreshCwIcon, ChevronDownIcon, ChevronRightIcon } from 'lucide-react'
import type { Tool } from '@modelcontextprotocol/sdk/types.js'

interface ToolsPanelProps {
    serverId: string
    isConnected: boolean
}

export function ToolsPanel({ serverId, isConnected }: ToolsPanelProps) {
    const [tools, setTools] = useState<Tool[]>([])
    const [loading, setLoading] = useState(false)
    const [expandedTool, setExpandedTool] = useState<string | null>(null)
    const [args, setArgs] = useState<Record<string, string>>({})
    const [result, setResult] = useState<string | null>(null)
    const [executing, setExecuting] = useState(false)

    const fetchTools = useCallback(async () => {
        if (!isConnected) {
            setTools([])
            return
        }
        setLoading(true)
        try {
            const res = await fetch(`/api/mcp/tools?serverId=${encodeURIComponent(serverId)}`)
            const data = await res.json()
            if (data.tools) {
                setTools(data.tools)
            }
        } catch {
            setTools([])
        } finally {
            setLoading(false)
        }
    }, [serverId, isConnected])

    useEffect(() => {
        fetchTools()
    }, [fetchTools])

    const handleExecute = async (toolName: string) => {
        setExecuting(true)
        setResult(null)
        try {
            // 인자 파싱 (JSON으로)
            const parsedArgs: Record<string, unknown> = {}
            const tool = tools.find(t => t.name === toolName)
            if (tool?.inputSchema && typeof tool.inputSchema === 'object' && 'properties' in tool.inputSchema) {
                const props = tool.inputSchema.properties as Record<string, { type?: string }>
                for (const key of Object.keys(props)) {
                    const val = args[`${toolName}.${key}`]
                    if (val !== undefined && val !== '') {
                        // 간단한 타입 변환
                        const propType = props[key].type
                        if (propType === 'number' || propType === 'integer') {
                            parsedArgs[key] = Number(val)
                        } else if (propType === 'boolean') {
                            parsedArgs[key] = val === 'true'
                        } else if (propType === 'object' || propType === 'array') {
                            try {
                                parsedArgs[key] = JSON.parse(val)
                            } catch {
                                parsedArgs[key] = val
                            }
                        } else {
                            parsedArgs[key] = val
                        }
                    }
                }
            }

            const res = await fetch('/api/mcp/tools/call', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serverId,
                    name: toolName,
                    arguments: parsedArgs
                })
            })
            const data = await res.json()
            if (data.error) {
                setResult(`오류: ${data.error}`)
            } else {
                setResult(JSON.stringify(data.content, null, 2))
            }
        } catch (err) {
            setResult(`실행 오류: ${err instanceof Error ? err.message : '알 수 없는 오류'}`)
        } finally {
            setExecuting(false)
        }
    }

    if (!isConnected) {
        return (
            <div className="text-center text-muted-foreground py-8">
                서버에 연결하면 도구 목록을 볼 수 있습니다.
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-medium">Tools ({tools.length})</h3>
                <Button variant="ghost" size="sm" onClick={fetchTools} disabled={loading}>
                    <RefreshCwIcon className={`size-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
            </div>

            {tools.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    {loading ? '로딩 중...' : '등록된 도구가 없습니다.'}
                </p>
            ) : (
                <div className="space-y-2">
                    {tools.map(tool => {
                        const isExpanded = expandedTool === tool.name
                        const schema = tool.inputSchema as { properties?: Record<string, { type?: string; description?: string }>, required?: string[] } | undefined

                        return (
                            <Card key={tool.name}>
                                <CardHeader
                                    className="cursor-pointer py-3"
                                    onClick={() => setExpandedTool(isExpanded ? null : tool.name)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            {isExpanded ? (
                                                <ChevronDownIcon className="size-4" />
                                            ) : (
                                                <ChevronRightIcon className="size-4" />
                                            )}
                                            <CardTitle className="text-sm font-mono">
                                                {tool.name}
                                            </CardTitle>
                                        </div>
                                        <Badge variant="secondary">Tool</Badge>
                                    </div>
                                    {tool.description && (
                                        <CardDescription className="text-xs mt-1 ml-6">
                                            {tool.description}
                                        </CardDescription>
                                    )}
                                </CardHeader>
                                {isExpanded && (
                                    <CardContent className="pt-0 space-y-3">
                                        {schema?.properties && Object.keys(schema.properties).length > 0 && (
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground">
                                                    파라미터
                                                </Label>
                                                {Object.entries(schema.properties).map(([key, prop]) => (
                                                    <div key={key} className="space-y-1">
                                                        <Label htmlFor={`${tool.name}.${key}`} className="text-xs">
                                                            {key}
                                                            {schema.required?.includes(key) && (
                                                                <span className="text-destructive ml-1">*</span>
                                                            )}
                                                            {prop.type && (
                                                                <span className="text-muted-foreground ml-1">
                                                                    ({prop.type})
                                                                </span>
                                                            )}
                                                        </Label>
                                                        <Input
                                                            id={`${tool.name}.${key}`}
                                                            placeholder={prop.description || key}
                                                            value={args[`${tool.name}.${key}`] ?? ''}
                                                            onChange={e =>
                                                                setArgs(prev => ({
                                                                    ...prev,
                                                                    [`${tool.name}.${key}`]: e.target.value
                                                                }))
                                                            }
                                                            className="h-8 text-sm"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <Button
                                            size="sm"
                                            onClick={() => handleExecute(tool.name)}
                                            disabled={executing}
                                        >
                                            <PlayIcon className="size-4" />
                                            {executing ? '실행 중...' : '실행'}
                                        </Button>
                                        {result && expandedTool === tool.name && (
                                            <div className="mt-2">
                                                <Label className="text-xs text-muted-foreground">
                                                    결과
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

