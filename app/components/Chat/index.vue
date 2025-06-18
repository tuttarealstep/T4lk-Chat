<script setup lang="ts">
import { useChatNavigation } from '~/composables/useChatNavigation'
import { useChatStore } from '~/stores/chat'
import { useChatState } from '~/composables/chat/useChatState'
import { useMessageOperations } from '~/composables/chat/useMessageOperations'
import { useModelConfiguration } from '~/composables/chat/useModelConfiguration'
import type { Message } from '~/types/chat'

interface Props {
  threadId?: string
}

const props = defineProps<Props>()

// Stores and navigation
const chatStore = useChatStore()
const { updateUrlToThread, syncRouterToCurrentUrl } = useChatNavigation()

// Load initial messages if threadId is provided
const initialMessages: Message[] = []
if (props.threadId) {
  const { data: threadData } = await useFetch<any>(`/api/thread/${props.threadId}`)
  if (threadData.value && 'messages' in threadData.value) {
    const mappedMessages = threadData.value.messages.map((msg: any) => ({
      id: msg.id,
      role: msg.role,
      content: (msg.parts ?? []).reduce((acc: string, part: any) => {
        if (part.type === 'text') {
          return acc + part.text
        } else if (part.type === 'reasoning') {
          return acc + part.reasoning
        }
        return acc
      }, ''),
      model: msg.model,
      usage: msg.usage,
      generationStartAt: msg.generationStartAt,
      generationEndAt: msg.generationEndAt,
      parts: msg.parts
    }))
    
    initialMessages.push(...mappedMessages)
  }
}

// Model configuration
const modelConfig = useModelConfiguration()
const {
  selectedModel,
  reasoningConfig,
  webSearchEnabled,
  imageGenerationConfig,
  isModelSelected,
  supportsReasoningEffort,
  supportsWebSearch,
  supportsImages,
  supportsAttachments,
  selectedModelInfo,
  selectedModelDisplayName,
  initializeModel,
  updateFromPreferences,
  buildModelParams
} = modelConfig

// Chat state management
const chatState = useChatState({
  threadId: props.threadId,
  initialMessages
})

const {
  chat,
  pendingAttachmentIds,
  pendingAttachmentData,
  submitWithAttachments,
  isStreaming
} = chatState

// Update chat configuration to use model config
watchEffect(() => {
  // Update selected model in chat state
  chatState.selectedModel.value = selectedModel.value
  chatState.reasoningConfig.value = reasoningConfig.value
  chatState.webSearchEnabled.value = webSearchEnabled.value
  chatState.imageGenerationConfig.value = imageGenerationConfig.value
})

// Message operations
const messageOps = useMessageOperations({
  chat,
  selectedModel,
  onAttachmentsUpdate: (attachmentIds, attachmentData) => {
    pendingAttachmentIds.value = attachmentIds
    pendingAttachmentData.value = attachmentData || []
  }
})

const { handleEditMessage, handleRetryMessage, getMessagesAfterCount } = messageOps

// Error recovery state
const hasCheckedPendingStatus = ref(false)

// Check for pending thread status and add error message
const checkForErrorMessage = async () => {
  if (!props.threadId || hasCheckedPendingStatus.value) return

  const currentThread = chatStore.threads.find(t => t.id === props.threadId)
  if (!currentThread) return

  if (currentThread.generationStatus === 'pending' || currentThread.generationStatus === 'generating') {
    await new Promise(resolve => setTimeout(resolve, 500))

    const lastMessage = chat.messages.value[chat.messages.value.length - 1]
    const needsErrorMessage = !lastMessage ||
      (lastMessage.role === 'user' && (currentThread.generationStatus === 'pending' || currentThread.generationStatus === 'generating')) ||
      (lastMessage.role === 'assistant' && !lastMessage.content && currentThread.generationStatus === 'generating')

    if (needsErrorMessage) {
      const hasExistingError = chat.messages.value.some(msg => (msg as Message).isError)
      if (!hasExistingError) {
        const errorMessage = {
          id: `error-${Date.now()}`,
          role: 'assistant' as const,
          content: '',
          isError: true,
          errorType: currentThread.generationStatus,
          generationStartAt: Date.now(),
          generationEndAt: Date.now(),
          parts: [{
            type: 'text',
            text: ''
          }] as any[]
        }

        const newMessages = [...chat.messages.value, errorMessage]
        chat.setMessages(newMessages)
      }
    }
  }

  hasCheckedPendingStatus.value = true
}

// Provide data to child components
provide('chatState', chat)
provide('selectedModel', selectedModel)
provide('reasoningConfig', reasoningConfig)
provide('webSearchEnabled', webSearchEnabled)
provide('imageGenerationConfig', imageGenerationConfig)
provide('isStreaming', isStreaming)
provide('getMessagesAfterCount', getMessagesAfterCount)
provide('submitWithAttachments', submitWithAttachments)

// Provide model configuration
provide('isModelSelected', isModelSelected)
provide('supportsReasoningEffort', supportsReasoningEffort)
provide('supportsWebSearch', supportsWebSearch)
provide('supportsImages', supportsImages)
provide('supportsAttachments', supportsAttachments)
provide('selectedModelInfo', selectedModelInfo)
provide('selectedModelDisplayName', selectedModelDisplayName)

// Component lifecycle
onMounted(async () => {
  // Set current thread in store
  chatStore.setCurrentThread(props.threadId || null)
  
  // Initialize model configuration
  initializeModel()
  await updateFromPreferences()
  
  // Check for error messages
  await checkForErrorMessage()
})

// Watch for threadId changes
watch(() => props.threadId, async (newThreadId) => {
  chatStore.setCurrentThread(newThreadId || null)
  
  if (!newThreadId) {
    await navigateTo('/')
  }
})

// Watch for threads and messages to check for error states
watch([() => chatStore.threads.length, () => chat.messages.value.length], async () => {
  if (chatStore.threads.length > 0) {
    await checkForErrorMessage()
  }
}, { immediate: true })

// Template refs for child components
const chatMessages = useTemplateRef('chatMessages')
const chatInputForm = useTemplateRef('chatInputForm')

// Scroll functionality exposed to child components
const scrollToBottom = () => {
  if (chatMessages.value && 'scrollToBottom' in chatMessages.value) {
    (chatMessages.value as any).scrollToBottom()
  }
}

const showScrollToBottom = computed(() => {
  if (chatMessages.value && 'showScrollToBottom' in chatMessages.value) {
    return (chatMessages.value as any).showScrollToBottom
  }
  return false
})

provide('scrollToBottom', scrollToBottom)
provide('showScrollToBottom', showScrollToBottom)

// Handle padding update for input form
let resizeObserver: ResizeObserver | null = null

const updatePadding = () => {
  if (chatInputForm.value && chatMessages.value) {
    const formElement = chatInputForm.value.$el || chatInputForm.value
    if (formElement && typeof formElement.querySelector === 'function') {
      const inputContainer = formElement.querySelector('#chat-input-container')
      if (inputContainer) {
        const inputHeight = inputContainer.offsetHeight
        const messagesElement = chatMessages.value.$el || chatMessages.value
        if (messagesElement && messagesElement.style) {
          messagesElement.style.paddingBottom = `${inputHeight + 14}px`
        }
      }
    }
  }
}

watchEffect(() => {
  if (chatInputForm.value && chatMessages.value) {
    updatePadding()
    if (resizeObserver) resizeObserver.disconnect()
    resizeObserver = new ResizeObserver(updatePadding)

    const formElement = chatInputForm.value.$el || chatInputForm.value
    if (formElement && formElement instanceof Element) {
      resizeObserver.observe(formElement)
    }
  }
})

onUnmounted(() => {
  if (resizeObserver) resizeObserver.disconnect()
})
</script>

<template>
  <div class="absolute top-0 bottom-0 w-full">
    <ChatInputForm
      ref="chatInputForm"
      :thread-id="threadId"
    />
    <ChatMessages
      ref="chatMessages"
      @edit-message="handleEditMessage"
      @retry-message="handleRetryMessage"
    />
  </div>
</template>