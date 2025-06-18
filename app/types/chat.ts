import type { useChat, UIMessage as BaseUIMessage  } from '@ai-sdk/vue'


export type VueChatState = ReturnType<typeof useChat>

export const CHAT_STATE_KEY = 'chatState' as const

export interface UIMessage extends BaseUIMessage {
    model?: string
    usage?: {
        promptTokens?: number
        completionTokens?: number
        totalTokens?: number
    }
    generationStartAt?: number
    generationEndAt?: number
    isError?: boolean
    errorType?: 'pending' | 'generating' | 'failed'
}

export interface ChatState {
    messages: UIMessage[]
    status: 'idle' | 'submitted' | 'streaming' | 'error'
}
