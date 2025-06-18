<script setup lang="ts">
import { ref, computed, provide } from 'vue'
import type { UIMessage } from '~/types/chat'

interface ShareData {
    shareId: string;
    name: string | null;
    thread: {
        id: string;
        title: string;
        createdAt: string;
    };
    messages: Array<{
        id: string;
        role: 'user' | 'assistant';
        parts: Array<{
            type: string;
            text?: string;
            reasoning?: string;
            mimeType?: string;
            data?: string;
            name?: string;
        }>;
        usage?: {
            promptTokens?: number;
            completionTokens?: number;
            totalTokens?: number;
        };
        model: string;
        generationStartAt?: string;
        generationEndAt?: string;
        createdAt: string;
    }>;
    createdAt: string;
    updatedAt: string;
}

const props = defineProps<{
    shareData: ShareData
}>()

// Convert shared messages to UIMessage format
const messages = computed(() => {
    return props.shareData.messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.parts.map(part => {
            if (part.type === 'text') return part.text || ''
            if (part.type === 'reasoning') return part.reasoning || ''
            return ''
        }).join(''),
        parts: msg.parts,
        model: msg.model,
        usage: msg.usage,
        generationStartAt: msg.generationStartAt,
        generationEndAt: msg.generationEndAt,
        createdAt: new Date(msg.createdAt)
    } as UIMessage))
})

// Create a mock chat state for read-only mode
const chatState = {
    messages,
    status: ref('idle'),
    input: ref(''),
    data: ref(undefined),
    error: ref(undefined),
    isLoading: ref(false),
    // Mock functions that do nothing in read-only mode
    stop: () => { },
    reload: () => { },
    handleSubmit: () => { },
    append: () => { },
    setMessages: () => { }
}

// Provide the chat state to child components
provide('chatState', chatState)

// Template refs
const chatMessages = useTemplateRef('chatMessages')

// Scroll functions for parent component access
const scrollToBottom = () => {
    if (chatMessages.value && 'scrollToBottom' in chatMessages.value) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (chatMessages.value as any).scrollToBottom()
    }
}

const showScrollToBottom = computed(() => {
    if (chatMessages.value && 'showScrollToBottom' in chatMessages.value) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (chatMessages.value as any).showScrollToBottom
    }
    return false
})

// Expose methods to parent
defineExpose({
    scrollToBottom,
    showScrollToBottom
})
</script>

<template>
    <div class="absolute top-0 bottom-0 w-full">
        <!-- No input form in read-only mode -->
        <ChatMessages 
            ref="chatMessages" 
            :read-only="true"
            @edit-message="() => { }" 
            @retry-message="() => { }" 
        />
    </div>
</template>
