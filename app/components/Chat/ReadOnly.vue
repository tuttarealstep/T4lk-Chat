<script setup lang="ts">
import type { Message } from '~/types/chat'

interface Props {
  messages: Message[]
}

const props = defineProps<Props>()

// Mock chat state for read-only mode
const mockChatState = {
  messages: computed(() => props.messages),
  status: ref('idle' as const)
}

// Provide mock chat state to Messages component
provide('chatState', mockChatState)
</script>

<template>
  <div class="absolute top-0 bottom-0 w-full">
    <ChatMessages 
      read-only 
      @edit-message="() => {}" 
      @retry-message="() => {}"
    />
  </div>
</template>