import { GoogleGenAI, FunctionCallingConfigMode, mcpToTool } from '@google/genai'
import mcpClientManager from '@/lib/mcp/client-manager'

export const runtime = 'nodejs'

interface ChatRequest {
    prompt: string
    enableMcpTools?: boolean
    serverIds?: string[]
    serverNames?: Record<string, string>
}

// SSE 이벤트 타입
type SSEEvent =
    | { type: 'text'; delta: string }
    | { type: 'tool_call_start'; name: string; serverId: string; args: Record<string, unknown> }
    | { type: 'tool_call_end'; name: string; serverId: string; result: string; isError?: boolean }
    | { type: 'error'; code: string; message: string }
    | { type: 'done' }

function sseEncode(data: SSEEvent): Uint8Array {
    const encoder = new TextEncoder()
    return encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
}

export async function POST(req: Request) {
    const body = (await req.json()) as ChatRequest
    const { prompt, enableMcpTools = false, serverIds = [] } = body
    const model = process.env.LLM_MODEL || 'gemini-2.5-flash'
    const apiKey = process.env.GEMINI_API_KEY

    const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
            try {
                if (!apiKey) {
                    controller.enqueue(
                        sseEncode({
                            type: 'error',
                            code: 'NO_API_KEY',
                            message: '서버에 GEMINI_API_KEY가 설정되지 않았습니다.'
                        })
                    )
                    controller.enqueue(sseEncode({ type: 'done' }))
                    controller.close()
                    return
                }

                if (!prompt?.trim()) {
                    controller.enqueue(
                        sseEncode({
                            type: 'error',
                            code: 'NO_PROMPT',
                            message: '질문이 필요합니다.'
                        })
                    )
                    controller.enqueue(sseEncode({ type: 'done' }))
                    controller.close()
                    return
                }

                const ai = new GoogleGenAI({ apiKey })

                // MCP Tools 수집 (mcpToTool 사용)
                const mcpTools: ReturnType<typeof mcpToTool>[] = []
                const toolNameServerMap = new Map<string, string>() // toolName -> serverId

                if (enableMcpTools && serverIds.length > 0) {
                    for (const serverId of serverIds) {
                        const client = mcpClientManager.getClient(serverId)
                        if (client) {
                            mcpTools.push(mcpToTool(client))

                            // 도구 이름 매핑을 위해 도구 목록 조회
                            try {
                                const tools = await mcpClientManager.getTools(serverId)
                                for (const tool of tools) {
                                    toolNameServerMap.set(tool.name, serverId)
                                }
                            } catch {
                                // 도구 목록 조회 실패 시 무시
                            }
                        }
                    }
                }

                const hasTools = mcpTools.length > 0

                // mcpToTool은 자동 함수 호출을 지원하므로 generateContent 사용
                // 함수 호출 과정 추적을 위해 automaticFunctionCallingHistory 활용
                const response = await ai.models.generateContent({
                    model,
                    contents: prompt,
                    config: hasTools
                        ? {
                              tools: mcpTools,
                              toolConfig: {
                                  functionCallingConfig: {
                                      mode: FunctionCallingConfigMode.AUTO
                                  }
                              }
                          }
                        : undefined
                })

                // 자동 함수 호출 이력 추적 및 SSE 이벤트 전송
                // mcpToTool은 자동 함수 호출을 지원하므로, automaticFunctionCallingHistory를 통해 추적
                if (hasTools) {
                    // automaticFunctionCallingHistory가 있는 경우
                    if (response.automaticFunctionCallingHistory) {
                        for (const historyItem of response.automaticFunctionCallingHistory) {
                            // historyItem은 Content 형식
                            for (const part of historyItem.parts || []) {
                                if ('functionCall' in part && part.functionCall) {
                                    const toolName = part.functionCall.name
                                    if (!toolName) continue

                                    const args = (part.functionCall.args as Record<string, unknown>) ?? {}
                                    const serverId = toolNameServerMap.get(toolName) ?? 'unknown'

                                    // Tool 실행 시작 알림
                                    controller.enqueue(
                                        sseEncode({
                                            type: 'tool_call_start',
                                            name: toolName,
                                            serverId,
                                            args
                                        })
                                    )
                                }

                                if ('functionResponse' in part && part.functionResponse) {
                                    const toolName = part.functionResponse.name
                                    if (!toolName) continue

                                    const responseData = part.functionResponse.response as Record<string, unknown>
                                    const serverId = toolNameServerMap.get(toolName) ?? 'unknown'

                                    // 결과 추출
                                    let resultText = ''
                                    let isError = false

                                    if (responseData.error) {
                                        resultText = String(responseData.error)
                                        isError = true
                                    } else if (responseData.result) {
                                        resultText = String(responseData.result)
                                    } else {
                                        resultText = JSON.stringify(responseData)
                                    }

                                    // Tool 실행 완료 알림
                                    controller.enqueue(
                                        sseEncode({
                                            type: 'tool_call_end',
                                            name: toolName,
                                            serverId,
                                            result: resultText,
                                            isError
                                        })
                                    )
                                }
                            }
                        }
                    }
                    // automaticFunctionCallingHistory가 없지만 functionCalls가 있는 경우 (fallback)
                    else if (response.functionCalls && response.functionCalls.length > 0) {
                        // 자동 함수 호출이 완료된 후 functionCalls가 남아있을 수 있음
                        // 이 경우는 이미 처리되었을 가능성이 높으므로 로그만 남김
                        for (const functionCall of response.functionCalls) {
                            const toolName = functionCall.name
                            if (!toolName) continue

                            const serverId = toolNameServerMap.get(toolName) ?? 'unknown'
                            // 이미 자동 처리되었을 가능성이 높으므로 완료 이벤트만 전송
                            controller.enqueue(
                                sseEncode({
                                    type: 'tool_call_end',
                                    name: toolName,
                                    serverId,
                                    result: '자동 처리됨',
                                    isError: false
                                })
                            )
                        }
                    }
                }

                // 최종 텍스트 응답을 청크 단위로 스트리밍
                // mcpToTool은 자동 함수 호출을 지원하므로 generateContent 사용 후 텍스트를 스트리밍
                const text = response.text ?? ''
                if (text) {
                    // 텍스트를 단어/문장 단위로 나누어 더 자연스럽게 스트리밍
                    // 공백이나 문장 부호를 기준으로 분할
                    const words = text.split(/(\s+|[.,!?;:])/)
                    let buffer = ''
                    for (const word of words) {
                        buffer += word
                        // 버퍼가 일정 크기 이상이거나 문장 끝이면 전송
                        if (buffer.length >= 20 || /[.!?]\s*$/.test(buffer)) {
                            controller.enqueue(sseEncode({ type: 'text', delta: buffer }))
                            buffer = ''
                        }
                    }
                    // 남은 버퍼 전송
                    if (buffer) {
                        controller.enqueue(sseEncode({ type: 'text', delta: buffer }))
                    }
                }

                controller.enqueue(sseEncode({ type: 'done' }))
                controller.close()
            } catch (err: unknown) {
                const status =
                    typeof err === 'object' && err && 'status' in err
                        ? (err as { status?: number }).status ?? 500
                        : 500
                let code = 'INTERNAL_ERROR'
                if (status === 401 || status === 403) code = 'UNAUTHORIZED'
                else if (status === 429) code = 'RATE_LIMIT'
                else if (status >= 500) code = 'UPSTREAM_ERROR'

                controller.enqueue(
                    sseEncode({
                        type: 'error',
                        code,
                        message:
                            typeof err === 'object' && err && 'message' in err
                                ? String((err as { message?: unknown }).message)
                                : '알 수 없는 오류가 발생했습니다.'
                    })
                )
                controller.enqueue(sseEncode({ type: 'done' }))
                controller.close()
            }
        }
    })

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no'
        }
    })
}

// 기존 GET 방식도 유지 (MCP 없는 간단한 요청용)
export async function GET(req: Request) {
    const url = new URL(req.url)
    const prompt = url.searchParams.get('q')?.trim()

    // POST로 리다이렉트
    const body: ChatRequest = { prompt: prompt ?? '' }

    const newReq = new Request(req.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    })

    return POST(newReq)
}
