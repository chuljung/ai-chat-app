'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PlayIcon, RefreshCwIcon, ChevronDownIcon, ChevronRightIcon } from 'lucide-react'
import type { Prompt } from '@modelcontextprotocol/sdk/types.js'

interface PromptsPanelProps {
    serverId: string
    isConnected: boolean
}

export function PromptsPanel({ serverId, isConnected }: PromptsPanelProps) {
    const [prompts, setPrompts] = useState<Prompt[]>([])
    const [loading, setLoading] = useState(false)
    const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null)
    const [args, setArgs] = useState<Record<string, string>>({})
    const [result, setResult] = useState<string | null>(null)
    const [executing, setExecuting] = useState(false)

    const fetchPrompts = useCallback(async () => {
        if (!isConnected) {
            setPrompts([])
            return
        }
        setLoading(true)
        try {
            const res = await fetch(`/api/mcp/prompts?serverId=${encodeURIComponent(serverId)}`)
            const data = await res.json()
            if (data.prompts) {
                setPrompts(data.prompts)
            }
        } catch {
            setPrompts([])
        } finally {
            setLoading(false)
        }
    }, [serverId, isConnected])

    useEffect(() => {
        fetchPrompts()
    }, [fetchPrompts])

    const handleExecute = async (promptName: string) => {
        setExecuting(true)
        setResult(null)
        try {
            const prompt = prompts.find(p => p.name === promptName)
            const parsedArgs: Record<string, string> = {}
            if (prompt?.arguments) {
                for (const arg of prompt.arguments) {
                    const val = args[`${promptName}.${arg.name}`]
                    if (val !== undefined && val !== '') {
                        parsedArgs[arg.name] = val
                    }
                }
            }

            const res = await fetch('/api/mcp/prompts/get', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serverId,
                    name: promptName,
                    arguments: parsedArgs
                })
            })
            const data = await res.json()
            if (data.error) {
                setResult(`오류: ${data.error}`)
            } else {
                setResult(JSON.stringify(data, null, 2))
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
                서버에 연결하면 프롬프트 목록을 볼 수 있습니다.
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-medium">Prompts ({prompts.length})</h3>
                <Button variant="ghost" size="sm" onClick={fetchPrompts} disabled={loading}>
                    <RefreshCwIcon className={`size-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
            </div>

            {prompts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    {loading ? '로딩 중...' : '등록된 프롬프트가 없습니다.'}
                </p>
            ) : (
                <div className="space-y-2">
                    {prompts.map(prompt => {
                        const isExpanded = expandedPrompt === prompt.name

                        return (
                            <Card key={prompt.name}>
                                <CardHeader
                                    className="cursor-pointer py-3"
                                    onClick={() => setExpandedPrompt(isExpanded ? null : prompt.name)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            {isExpanded ? (
                                                <ChevronDownIcon className="size-4" />
                                            ) : (
                                                <ChevronRightIcon className="size-4" />
                                            )}
                                            <CardTitle className="text-sm font-mono">
                                                {prompt.name}
                                            </CardTitle>
                                        </div>
                                        <Badge variant="outline">Prompt</Badge>
                                    </div>
                                    {prompt.description && (
                                        <CardDescription className="text-xs mt-1 ml-6">
                                            {prompt.description}
                                        </CardDescription>
                                    )}
                                </CardHeader>
                                {isExpanded && (
                                    <CardContent className="pt-0 space-y-3">
                                        {prompt.arguments && prompt.arguments.length > 0 && (
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground">
                                                    인자
                                                </Label>
                                                {prompt.arguments.map(arg => (
                                                    <div key={arg.name} className="space-y-1">
                                                        <Label htmlFor={`${prompt.name}.${arg.name}`} className="text-xs">
                                                            {arg.name}
                                                            {arg.required && (
                                                                <span className="text-destructive ml-1">*</span>
                                                            )}
                                                        </Label>
                                                        <Input
                                                            id={`${prompt.name}.${arg.name}`}
                                                            placeholder={arg.description || arg.name}
                                                            value={args[`${prompt.name}.${arg.name}`] ?? ''}
                                                            onChange={e =>
                                                                setArgs(prev => ({
                                                                    ...prev,
                                                                    [`${prompt.name}.${arg.name}`]: e.target.value
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
                                            onClick={() => handleExecute(prompt.name)}
                                            disabled={executing}
                                        >
                                            <PlayIcon className="size-4" />
                                            {executing ? '가져오는 중...' : '프롬프트 가져오기'}
                                        </Button>
                                        {result && expandedPrompt === prompt.name && (
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

