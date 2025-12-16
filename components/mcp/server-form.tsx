'use client'

import { useState, useEffect } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select'
import type { MCPServerConfig, MCPServerDefinition, MCPTransportType } from '@/lib/mcp/types'

interface ServerFormProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    server?: MCPServerDefinition | null
    onSubmit: (name: string, config: MCPServerConfig) => void
}

export function ServerForm({ open, onOpenChange, server, onSubmit }: ServerFormProps) {
    const [name, setName] = useState('')
    const [transportType, setTransportType] = useState<MCPTransportType>('stdio')
    
    // STDIO 관련
    const [command, setCommand] = useState('')
    const [args, setArgs] = useState('')
    const [env, setEnv] = useState('')
    
    // HTTP 관련
    const [url, setUrl] = useState('')

    // 서버 편집 시 초기값 설정
    useEffect(() => {
        if (server) {
            setName(server.name)
            setTransportType(server.config.type)
            if (server.config.type === 'stdio') {
                setCommand(server.config.command)
                setArgs(server.config.args?.join(' ') ?? '')
                setEnv(
                    server.config.env
                        ? Object.entries(server.config.env)
                              .map(([k, v]) => `${k}=${v}`)
                              .join('\n')
                        : ''
                )
                setUrl('')
            } else {
                setUrl(server.config.url)
                setCommand('')
                setArgs('')
                setEnv('')
            }
        } else {
            resetForm()
        }
    }, [server, open])

    const resetForm = () => {
        setName('')
        setTransportType('stdio')
        setCommand('')
        setArgs('')
        setEnv('')
        setUrl('')
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        
        let config: MCPServerConfig
        
        if (transportType === 'stdio') {
            const parsedArgs = args.trim() ? args.trim().split(/\s+/) : undefined
            const parsedEnv = env.trim()
                ? Object.fromEntries(
                      env
                          .trim()
                          .split('\n')
                          .map(line => {
                              const idx = line.indexOf('=')
                              return idx > 0
                                  ? [line.slice(0, idx), line.slice(idx + 1)]
                                  : [line, '']
                          })
                  )
                : undefined
            
            config = {
                type: 'stdio',
                command,
                args: parsedArgs,
                env: parsedEnv
            }
        } else {
            config = {
                type: 'streamable-http',
                url
            }
        }
        
        onSubmit(name.trim(), config)
        onOpenChange(false)
    }

    const isValid =
        name.trim() &&
        (transportType === 'stdio' ? command.trim() : url.trim())

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {server ? '서버 수정' : '새 MCP 서버 추가'}
                    </DialogTitle>
                    <DialogDescription>
                        MCP 서버 연결 정보를 입력하세요.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">서버 이름</Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="예: 파일시스템 서버"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="transport">연결 방식</Label>
                        <Select
                            value={transportType}
                            onValueChange={v => setTransportType(v as MCPTransportType)}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="stdio">STDIO</SelectItem>
                                <SelectItem value="streamable-http">
                                    Streamable HTTP
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {transportType === 'stdio' ? (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="command">명령어</Label>
                                <Input
                                    id="command"
                                    value={command}
                                    onChange={e => setCommand(e.target.value)}
                                    placeholder="예: npx, node, python"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="args">인자 (공백 구분)</Label>
                                <Input
                                    id="args"
                                    value={args}
                                    onChange={e => setArgs(e.target.value)}
                                    placeholder="예: -y @anthropic/mcp-server-filesystem"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="env">환경변수 (한 줄에 KEY=VALUE)</Label>
                                <textarea
                                    id="env"
                                    value={env}
                                    onChange={e => setEnv(e.target.value)}
                                    placeholder="NODE_ENV=production"
                                    className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                />
                            </div>
                        </>
                    ) : (
                        <div className="space-y-2">
                            <Label htmlFor="url">서버 URL</Label>
                            <Input
                                id="url"
                                type="url"
                                value={url}
                                onChange={e => setUrl(e.target.value)}
                                placeholder="예: http://localhost:3001/mcp"
                            />
                        </div>
                    )}

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            취소
                        </Button>
                        <Button type="submit" disabled={!isValid}>
                            {server ? '저장' : '추가'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

