<script setup lang="ts">
import type { Message } from '~/types/chat'
import type { UseChatHelpers } from '@ai-sdk/vue'
import { useScrollManagement } from '~/composables/chat/useScrollManagement'
import ProsePreStream from '../prose/ProsePreStream.vue'

interface Props {
  readOnly?: boolean
}

interface Emits {
  'edit-message': [messageId: string, newText: string]
  'retry-message': [messageId: string, modelId?: string]
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const { t } = useI18n()

// Inject chat state from parent
const chatState = inject('chatState') as UseChatHelpers
if (!chatState) {
  throw new Error('ChatMessages must be used within a Chat component')
}

const { messages, status } = chatState

// Scroll management
const scrollManager = useScrollManagement()
const {
  scrollContainer,
  hasScrollableContent,
  shouldShowScrollButton,
  scrollToBottom,
  initializeScroll,
  setupScrollListeners,
  watchForChanges
} = scrollManager

// MDC components for message rendering
const mdcComponents = {
  pre: ProsePreStream as any
}

// Message handlers
const handleEditMessage = (messageId: string, newText: string) => {
  emit('edit-message', messageId, newText)
}

const handleRetryMessage = (messageId: string, modelId?: string) => {
  emit('retry-message', messageId, modelId)
}

// Setup scroll management
onMounted(() => {
  initializeScroll()
  const cleanup = setupScrollListeners()
  
  onUnmounted(cleanup)
})

// Watch for message and status changes
watchForChanges(messages, status)

// Expose scroll functionality to parent
defineExpose({
  scrollToBottom,
  showScrollToBottom: shouldShowScrollButton
})
</script>

<template>
  <div
    ref="scrollContainer"
    class="absolute inset-0 overflow-y-scroll sm:pt-3.5"
    style="scrollbar-gutter: stable both-edges;"
  >
    <div
      class="mx-auto flex w-full max-w-3xl flex-col space-y-12 px-4 pb-10 pt-safe-offset-10"
      aria-label="Chat messages"
    >
      <!-- Welcome message when no messages -->
      <ChatWelkomeMessage v-if="!messages || messages.length === 0" />

      <!-- Chat messages -->
      <ClientOnly>
        <div v-for="(message, index) in messages" :key="message.id">
          <ChatMessage
            :message="message as Message"
            :is-last-message="index === messages.length - 1"
            :read-only="props.readOnly"
            @edit-message="handleEditMessage"
            @retry-message="handleRetryMessage"
          >
            <template #content="{ message: slotMessage, isLastMessage: slotIsLastMessage }">
              <MDCCached
                :value="slotMessage.content"
                :cache-key="slotMessage.id"
                unwrap="p"
                :components="mdcComponents"
                :parser-options="{ highlight: false }"
              />

              <!-- Loading indicator for submitted messages -->
              <div 
                v-if="slotMessage.role === 'assistant' && status === 'submitted' && slotIsLastMessage"
                class="h-6 flex items-center gap-1 py-3"
              >
                <span class="size-2 rounded-full bg-secondary-foreground animate-bounce" />
                <span class="size-2 rounded-full bg-secondary-foreground animate-bounce [animation-delay:0.2s]" />
                <span class="size-2 rounded-full bg-secondary-foreground animate-bounce [animation-delay:0.4s]" />
              </div>

              <!-- Streaming indicator -->
              <div 
                v-if="slotMessage.role === 'assistant' && status === 'streaming' && slotIsLastMessage"
                class="flex items-center"
              >
                <Icon name="lucide:loader" class="size-4 animate-spin text-secondary-foreground" />
              </div>
            </template>
          </ChatMessage>
        </div>
      </ClientOnly>

      <!-- Global error message -->
      <div v-if="status === 'error'" class="mx-auto max-w-2xl">
        <div class="rounded-lg border border-destructive/20 bg-destructive/10 p-4">
          <div class="flex items-center gap-3">
            <div class="flex-shrink-0">
              <Icon name="lucide:alert-circle" class="size-5 text-destructive" />
            </div>
            <div class="flex-1">
              <h3 class="text-sm font-medium text-destructive">
                {{ t('chat.chat_error') }}
              </h3>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>