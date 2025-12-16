'use client'

import { WrenchIcon, CheckCircleIcon, XCircleIcon, LoaderIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ToolCallInfo {
    id: string
    name: string
    serverId: string
    args: Record<string, unknown>
    status: 'running' | 'success' | 'error'
    result?: string
}

interface ToolCallCardProps {
    toolCall: ToolCallInfo
}

export function ToolCallCard({ toolCall }: ToolCallCardProps) {
    const { name, args, status, result } = toolCall

    return (
        <div
            className={cn(
                'rounded-lg border p-3 text-sm',
                status === 'running' && 'border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20',
                status === 'success' && 'border-green-500/50 bg-green-50 dark:bg-green-950/20',
                status === 'error' && 'border-red-500/50 bg-red-50 dark:bg-red-950/20'
            )}
        >
            <div className="flex items-center gap-2 mb-2">
                <WrenchIcon className="size-4 text-muted-foreground" />
                <span className="font-mono font-medium">{name}</span>
                <span className="flex-1" />
                {status === 'running' && (
                    <LoaderIcon className="size-4 text-yellow-600 animate-spin" />
                )}
                {status === 'success' && (
                    <CheckCircleIcon className="size-4 text-green-600" />
                )}
                {status === 'error' && (
                    <XCircleIcon className="size-4 text-red-600" />
                )}
            </div>

            {/* 인자 표시 */}
            {Object.keys(args).length > 0 && (
                <div className="mb-2">
                    <div className="text-xs text-muted-foreground mb-1">인자:</div>
                    <pre className="text-xs bg-black/5 dark:bg-white/5 rounded p-2 overflow-x-auto">
                        {JSON.stringify(args, null, 2)}
                    </pre>
                </div>
            )}

            {/* 결과 표시 */}
            {result && (
                <div>
                    <div className="text-xs text-muted-foreground mb-1">
                        {status === 'error' ? '오류:' : '결과:'}
                    </div>
                    <pre
                        className={cn(
                            'text-xs rounded p-2 overflow-x-auto max-h-40',
                            status === 'error'
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                                : 'bg-black/5 dark:bg-white/5'
                        )}
                    >
                        {result}
                    </pre>
                </div>
            )}
        </div>
    )
}

