<script setup lang="ts">
import type { Message } from '~/types/chat'

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

interface Props {
  shareData?: ShareData;
  messages?: Message[];
}

const props = defineProps<Props>()

// Convert share data messages to our Message type
const convertedMessages = computed((): Message[] => {
  if (props.messages) {
    return props.messages
  }
  
  if (props.shareData?.messages) {
    return props.shareData.messages.map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.parts?.find(part => part.type === 'text')?.text || '',
      parts: msg.parts?.map(part => ({
        type: part.type,
        text: part.text,
        mimeType: part.mimeType,
        data: part.data,
        name: part.name
      })) || [],
      usage: msg.usage,
      model: msg.model,
      generationStartAt: msg.generationStartAt ? new Date(msg.generationStartAt).getTime() : undefined,
      generationEndAt: msg.generationEndAt ? new Date(msg.generationEndAt).getTime() : undefined,
      createdAt: new Date(msg.createdAt).getTime(),
      isError: false
    }))
  }
  
  return []
})

// Mock chat state for read-only mode
const mockChatState = {
  messages: convertedMessages,
  status: ref('idle' as const)
}

// Provide all necessary injections for ChatMessage component
provide('chatState', mockChatState)
provide('isStreaming', computed(() => false))
provide('selectedModel', ref(''))
provide('getMessagesAfterCount', () => 0)
</script>

<template>
  <div class="absolute inset-0 w-full overflow-y-auto pb-16" 
       style="scrollbar-gutter: stable both-edges;">
    <div class="mx-auto flex w-full max-w-3xl flex-col space-y-12 px-4 pb-10 pt-safe-offset-10">
      <div v-for="(message, index) in convertedMessages" :key="message.id">
        <ChatMessage
          :message="message"
          :is-last-message="index === convertedMessages.length - 1"
          read-only
          @edit-message="() => {}"
          @retry-message="() => {}"
        >
          <template #content="{ message: slotMessage }">
            <MDCCached
              :value="slotMessage.content"
              :cache-key="slotMessage.id"
              unwrap="p"
              :parser-options="{ highlight: false }"
            />
          </template>
        </ChatMessage>
      </div>
    </div>
  </div>
</template>