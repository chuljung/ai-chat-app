'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { useMCP } from '@/components/mcp/mcp-provider'
import { ToolCallCard, type ToolCallInfo } from '@/components/mcp/tool-call-card'
import { SettingsIcon, WrenchIcon, ToggleLeftIcon, ToggleRightIcon } from 'lucide-react'

type ChatMessagePart =
    | { type: 'text'; content: string }
    | { type: 'tool_call'; toolCall: ToolCallInfo }

type ChatMessage = {
    role: 'user' | 'assistant'
    parts: ChatMessagePart[]
}

const STORAGE_KEY = 'chat:session:v2'
const MCP_ENABLED_KEY = 'chat:mcp:enabled'

export default function Home() {
    const { servers } = useMCP()
    const connectedServers = servers.filter(s => s.runtime.status === 'connected')
    const connectedCount = connectedServers.length

    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [mcpEnabled, setMcpEnabled] = useState(false)
    const abortRef = useRef<AbortController | null>(null)
    const endRef = useRef<HTMLDivElement | null>(null)
    const hasLoadedRef = useRef(false)

    // Markdown 컴포넌트
    const markdownComponents: Components = useMemo(
        () => ({
            code({ className, children, ...props }) {
                const codeText = String(children).replace(/\n$/, '')
                const isInline =
                    !/(^|\s)language-[\w-]+/.test(className || '') &&
                    !codeText.includes('\n')
                if (isInline) {
                    return (
                        <code
                            className="rounded bg-gray-200 dark:bg-gray-700 px-1 py-0.5 text-[0.85em]"
                            {...props}
                        >
                            {children}
                        </code>
                    )
                }
                return (
                    <div className="relative group">
                        <button
                            type="button"
                            onClick={async () => {
                                try {
                                    await navigator.clipboard.writeText(codeText)
                                } catch {}
                            }}
                            className="absolute top-2 right-2 rounded-md border px-2 py-1 text-xs bg-white/80 dark:bg-black/50 hover:bg-white dark:hover:bg-black text-gray-700 dark:text-gray-200 opacity-0 group-hover:opacity-100 transition"
                        >
                            복사
                        </button>
                        <pre className="overflow-x-auto rounded-md bg-gray-950 text-gray-100 p-3 text-[0.9em]">
                            <code className={className}>{codeText}</code>
                        </pre>
                    </div>
                )
            },
            a({ href, children, ...props }) {
                return (
                    <a
                        href={href as string}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline"
                        {...props}
                    >
                        {children}
                    </a>
                )
            },
            table({ children }) {
                return (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-sm">
                            {children}
                        </table>
                    </div>
                )
            }
        }),
        []
    )

    // 초기 로드
    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY)
            if (raw) setMessages(JSON.parse(raw) as ChatMessage[])

            const mcpEnabledRaw = localStorage.getItem(MCP_ENABLED_KEY)
            if (mcpEnabledRaw) setMcpEnabled(JSON.parse(mcpEnabledRaw))
        } catch {}
        hasLoadedRef.current = true
    }, [])

    // 메시지 저장
    useEffect(() => {
        if (!hasLoadedRef.current) return
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
        } catch {}
    }, [messages])

    // MCP 설정 저장
    useEffect(() => {
        if (!hasLoadedRef.current) return
        try {
            localStorage.setItem(MCP_ENABLED_KEY, JSON.stringify(mcpEnabled))
        } catch {}
    }, [mcpEnabled])

    // 스크롤
    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, loading])

    const canSend = useMemo(
        () => input.trim().length > 0 && !loading,
        [input, loading]
    )

    // 메시지 전송
    const handleSend = useCallback(
        async (e?: React.FormEvent) => {
            e?.preventDefault()
            const prompt = input.trim()
            if (!prompt || loading) return

            setInput('')
            setLoading(true)
            const controller = new AbortController()
            abortRef.current = controller

            const userMsg: ChatMessage = { role: 'user', parts: [{ type: 'text', content: prompt }] }
            const aiMsg: ChatMessage = { role: 'assistant', parts: [] }
            setMessages(prev => [...prev, userMsg, aiMsg])

            // Tool call 추적
            const activeToolCalls = new Map<string, ToolCallInfo>()
            let toolCallCounter = 0

            try {
                const serverIds = connectedServers.map(s => s.id)
                const serverNames = Object.fromEntries(connectedServers.map(s => [s.id, s.name]))

                const res = await fetch('/api/chat/stream', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'text/event-stream'
                    },
                    body: JSON.stringify({
                        prompt,
                        enableMcpTools: mcpEnabled && connectedCount > 0,
                        serverIds,
                        serverNames
                    }),
                    signal: controller.signal
                })

                if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

                const reader = res.body.getReader()
                const decoder = new TextDecoder()
                let textBuffer = ''
                let sseBuffer = ''

                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break

                    const chunk = decoder.decode(value, { stream: true })
                    sseBuffer += chunk
                    const events = sseBuffer.split(/\n\n/)
                    sseBuffer = events.pop() ?? ''

                    for (const line of events) {
                        const m = line.match(/^data: (.*)$/m)
                        if (!m) continue

                        try {
                            const evt = JSON.parse(m[1])

                            if (evt.type === 'text' && typeof evt.delta === 'string') {
                                textBuffer += evt.delta
                                setMessages(prev => {
                                    const next = [...prev]
                                    const lastMsg = next[next.length - 1]
                                    const textPart = lastMsg.parts.find(p => p.type === 'text')
                                    if (textPart && textPart.type === 'text') {
                                        textPart.content = textBuffer
                                    } else {
                                        lastMsg.parts.push({ type: 'text', content: textBuffer })
                                    }
                                    return next
                                })
                            } else if (evt.type === 'tool_call_start') {
                                const toolCallId = `tc-${++toolCallCounter}`
                                const toolCall: ToolCallInfo = {
                                    id: toolCallId,
                                    name: evt.name,
                                    serverId: evt.serverId,
                                    args: evt.args,
                                    status: 'running'
                                }
                                activeToolCalls.set(evt.name, toolCall)

                                setMessages(prev => {
                                    const next = [...prev]
                                    const lastMsg = next[next.length - 1]
                                    lastMsg.parts.push({ type: 'tool_call', toolCall: { ...toolCall } })
                                    return next
                                })
                            } else if (evt.type === 'tool_call_end') {
                                const toolCall = activeToolCalls.get(evt.name)
                                if (toolCall) {
                                    toolCall.status = evt.isError ? 'error' : 'success'
                                    toolCall.result = evt.result
                                    activeToolCalls.delete(evt.name)

                                    setMessages(prev => {
                                        const next = [...prev]
                                        const lastMsg = next[next.length - 1]
                                        const tcPart = lastMsg.parts.find(
                                            p => p.type === 'tool_call' && p.toolCall.id === toolCall.id
                                        )
                                        if (tcPart && tcPart.type === 'tool_call') {
                                            tcPart.toolCall = { ...toolCall }
                                        }
                                        return next
                                    })
                                }
                            } else if (evt.type === 'error') {
                                throw new Error(evt.message || '오류')
                            }
                        } catch {}
                    }
                }
            } catch (error) {
                setMessages(prev => {
                    const next = [...prev]
                    const lastMsg = next[next.length - 1]
                    const errorText = `\n\n[에러] ${
                        error instanceof Error ? error.message : '요청 중 오류가 발생했습니다.'
                    }`
                    const textPart = lastMsg.parts.find(p => p.type === 'text')
                    if (textPart && textPart.type === 'text') {
                        textPart.content += errorText
                    } else {
                        lastMsg.parts.push({ type: 'text', content: errorText })
                    }
                    return next
                })
            } finally {
                setLoading(false)
                abortRef.current = null
            }
        },
        [input, loading, mcpEnabled, connectedServers, connectedCount]
    )

    const handleStop = useCallback(() => {
        abortRef.current?.abort()
        setLoading(false)
    }, [])

    const handleClearChat = useCallback(() => {
        if (confirm('대화 내역을 모두 삭제하시겠습니까?')) {
            setMessages([])
        }
    }, [])

    // 메시지 텍스트 추출
    const getMessageText = (msg: ChatMessage): string => {
        return msg.parts
            .filter((p): p is { type: 'text'; content: string } => p.type === 'text')
            .map(p => p.content)
            .join('')
    }

    // Tool calls 추출
    const getToolCalls = (msg: ChatMessage): ToolCallInfo[] => {
        return msg.parts
            .filter((p): p is { type: 'tool_call'; toolCall: ToolCallInfo } => p.type === 'tool_call')
            .map(p => p.toolCall)
    }

    return (
        <div className="min-h-screen flex flex-col mx-auto max-w-3xl p-4 gap-4">
            <header className="flex items-center justify-between">
                <h1 className="text-xl font-semibold">AI 채팅</h1>
                <div className="flex items-center gap-3">
                    {/* MCP 도구 토글 */}
                    <button
                        type="button"
                        onClick={() => setMcpEnabled(!mcpEnabled)}
                        className={`flex items-center gap-1.5 text-sm px-2 py-1 rounded-md transition-colors ${
                            mcpEnabled && connectedCount > 0
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                        }`}
                        title={
                            connectedCount === 0
                                ? 'MCP 서버를 먼저 연결하세요'
                                : mcpEnabled
                                  ? 'MCP 도구 비활성화'
                                  : 'MCP 도구 활성화'
                        }
                    >
                        <WrenchIcon className="size-4" />
                        {mcpEnabled ? (
                            <ToggleRightIcon className="size-5" />
                        ) : (
                            <ToggleLeftIcon className="size-5" />
                        )}
                        {mcpEnabled && connectedCount > 0 && (
                            <span className="text-xs">{connectedCount}</span>
                        )}
                    </button>

                    <div className="text-xs text-gray-500">
                        모델: {process.env.NEXT_PUBLIC_LLM_MODEL || 'gemini-2.5-flash'}
                    </div>

                    <Link
                        href="/mcp"
                        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <SettingsIcon className="size-4" />
                        <span>MCP</span>
                        {connectedCount > 0 && (
                            <span className="flex items-center justify-center size-5 rounded-full bg-green-500 text-white text-xs">
                                {connectedCount}
                            </span>
                        )}
                    </Link>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto rounded-md border p-4 bg-white/50 dark:bg-black/20">
                {messages.length === 0 ? (
                    <div className="text-sm text-gray-500">
                        <p>질문을 입력해 대화를 시작하세요.</p>
                        {connectedCount > 0 && (
                            <p className="mt-2 text-green-600 dark:text-green-400">
                                <WrenchIcon className="inline size-4 mr-1" />
                                {connectedCount}개의 MCP 서버가 연결되어 있습니다.
                                {mcpEnabled
                                    ? ' 도구가 활성화되어 있습니다.'
                                    : ' 도구를 활성화하려면 상단 토글을 클릭하세요.'}
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {messages.map((m, i) => {
                            const isLastAssistant =
                                m.role === 'assistant' && i === messages.length - 1 && loading
                            const textContent = getMessageText(m)
                            const toolCalls = getToolCalls(m)

                            return (
                                <div
                                    key={i}
                                    className={m.role === 'user' ? 'text-right' : 'text-left'}
                                >
                                    <div
                                        className={
                                            m.role === 'user'
                                                ? 'inline-block rounded-2xl px-4 py-2 bg-blue-600 text-white whitespace-pre-wrap break-words'
                                                : 'inline-block rounded-2xl px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 max-w-full'
                                        }
                                        style={{ wordBreak: 'break-word' }}
                                    >
                                        {m.role === 'assistant' ? (
                                            <div className="space-y-3">
                                                {/* Tool Calls */}
                                                {toolCalls.length > 0 && (
                                                    <div className="space-y-2">
                                                        {toolCalls.map(tc => (
                                                            <ToolCallCard
                                                                key={tc.id}
                                                                toolCall={tc}
                                                            />
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Text Content */}
                                                {textContent && (
                                                    <div className="markdown-body leading-relaxed text-sm">
                                                        <ReactMarkdown
                                                            remarkPlugins={[remarkGfm]}
                                                            rehypePlugins={[rehypeHighlight]}
                                                            components={markdownComponents}
                                                        >
                                                            {textContent}
                                                        </ReactMarkdown>
                                                    </div>
                                                )}

                                                {isLastAssistant && (
                                                    <span className="inline-block w-2 align-baseline animate-pulse">
                                                        ▍
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            textContent
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                        <div ref={endRef} />
                    </div>
                )}
            </main>

            <form onSubmit={handleSend} className="flex gap-2">
                <input
                    className="flex-1 rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={
                        mcpEnabled && connectedCount > 0
                            ? 'MCP 도구를 사용할 수 있습니다...'
                            : '메시지를 입력하세요...'
                    }
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    disabled={loading}
                />
                {loading ? (
                    <button
                        type="button"
                        onClick={handleStop}
                        className="px-4 py-2 rounded-md bg-red-600 text-white"
                    >
                        중지
                    </button>
                ) : (
                    <button
                        type="submit"
                        disabled={!canSend}
                        className="px-4 py-2 rounded-md bg-blue-600 text-white disabled:opacity-50"
                    >
                        전송
                    </button>
                )}
            </form>

            <div className="flex items-center justify-between text-xs text-gray-500">
                <p>이 세션은 localStorage에 임시 저장됩니다. 공용 PC에서는 민감정보 입력에 유의하세요.</p>
                {messages.length > 0 && (
                    <button
                        type="button"
                        onClick={handleClearChat}
                        className="text-red-500 hover:text-red-600"
                    >
                        대화 삭제
                    </button>
                )}
            </div>
        </div>
    )
}
