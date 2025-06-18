import { useChat, type UseChatHelpers } from '@ai-sdk/vue'
import { useAiStore } from '~/stores/ai'
import { useUserStore } from '~/stores/user'
import { useChatStore } from '~/stores/chat'
import { useChatNavigation } from '~/composables/useChatNavigation'
import { LLM_FEATURES } from '#shared/ai/LLM'
import type { Message } from '~/types/chat'

export interface ChatStateOptions {
  threadId?: string
  initialMessages?: Message[]
}

export function useChatState(options: ChatStateOptions = {}) {
  const { threadId, initialMessages = [] } = options
  
  const aiStore = useAiStore()
  const userStore = useUserStore()
  const chatStore = useChatStore()
  const { updateUrlToThread, syncRouterToCurrentUrl } = useChatNavigation()

  // Reactive state for configuration
  const selectedModel = ref<string>('')
  const reasoningConfig = ref<Record<string, any>>({})
  const webSearchEnabled = ref(false)
  const imageGenerationConfig = ref<Record<string, any>>({
    n: 1,
    size: '1024x1024',
    openai: {
      quality: 'auto',
      background: 'auto',
      output_format: 'png',
      output_compression: 100,
      moderation: 'auto'
    }
  })
  
  // Attachment state
  const pendingAttachmentIds = ref<string[]>([])
  const pendingAttachmentData = ref<{ id: string; name: string; size: number; type: string; data?: string }[]>([])

  // Initialize useChat
  const chat = useChat({
    id: threadId,
    api: '/api/chat',
    initialMessages,
    body: computed(() => {
      const selectedModelInfo = aiStore.llms[selectedModel.value]
      const apiKeys = selectedModelInfo ? userStore.getApiKeyForModel(selectedModelInfo) : undefined
      
      const modelParams: any = { ...reasoningConfig.value }
      
      if (webSearchEnabled.value) {
        modelParams.webSearch = true
      }
      
      const isImageModel = selectedModelInfo?.features.includes(LLM_FEATURES.IMAGES)
      if (isImageModel && imageGenerationConfig.value) {
        modelParams.imageGeneration = imageGenerationConfig.value
      }
      
      return {
        model: selectedModel.value,
        modelParams,
        threadMetadata: { id: threadId },
        userInfo: {
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        },
        preferences: {
          name: userStore.preferences.name || '',
          occupation: userStore.preferences.occupation || '',
          selectedTraits: userStore.preferences.selectedTraits || [],
          additionalInfo: userStore.preferences.additionalInfo || '',
        },
        apiKeys,
        attachmentIds: pendingAttachmentIds.value.length > 0 ? pendingAttachmentIds.value : undefined,
      }
    }),
    async onFinish() {
      // Clear attachments
      pendingAttachmentIds.value = []
      pendingAttachmentData.value = []
      
      // Update thread status
      if (threadId) {
        const currentThread = chatStore.threads.find(t => t.id === threadId)
        if (currentThread && (currentThread.generationStatus === 'pending' || currentThread.generationStatus === 'generating')) {
          currentThread.generationStatus = 'completed'
        }
      }
      
      syncRouterToCurrentUrl()
      
      if (!threadId) {
        await chatStore.loadThreads()
      }
    },
    onError(error) {
      console.error('Chat error:', error)
      // Error handling logic will be managed by parent component
    },
    sendExtraMessageFields: true
  })

  // Helper to submit with attachments
  const submitWithAttachments = (attachmentIds: string[], attachmentData?: typeof pendingAttachmentData.value) => {
    pendingAttachmentIds.value = attachmentIds
    pendingAttachmentData.value = attachmentData || []
  }

  // Watch for data stream updates
  watchEffect(() => {
    if (!chat.data?.value) return
    
    for (const dataItem of chat.data.value) {
      if (dataItem && typeof dataItem === 'object') {
        if ('threadId' in dataItem) {
          const newThreadId = (dataItem as { threadId: string }).threadId
          if (newThreadId && newThreadId !== threadId) {
            updateUrlToThread(newThreadId, true)
          }
        }
        // Handle metrics and images updates
        else if ('type' in dataItem && dataItem.type === 'metrics') {
          handleMetricsUpdate(dataItem as any, chat.messages.value as Message[])
        }
        else if ('type' in dataItem && dataItem.type === 'images') {
          handleImagesUpdate(dataItem as any, chat.messages.value as Message[])
        }
      }
    }
  })

  const handleMetricsUpdate = (dataItem: any, messages: Message[]) => {
    const metrics = dataItem.data
    const targetMessage = messages.find(msg =>
      msg.id === metrics.messageId ||
      (msg.role === 'assistant' && messages.indexOf(msg) === messages.length - 1)
    ) as Message

    if (targetMessage && targetMessage.role === 'assistant') {
      if (!targetMessage.usage) targetMessage.usage = {}
      
      targetMessage.usage.promptTokens = metrics.promptTokens
      targetMessage.usage.completionTokens = metrics.completionTokens
      targetMessage.usage.totalTokens = metrics.totalTokens
      targetMessage.generationStartAt = metrics.generationStartAt
      targetMessage.generationEndAt = metrics.generationEndAt
      targetMessage.model = metrics.model

      if (metrics.messageId && targetMessage.id !== metrics.messageId) {
        targetMessage.id = metrics.messageId
      }

      chat.setMessages([...messages])
    }
  }

  const handleImagesUpdate = (dataItem: any, messages: Message[]) => {
    const imageData = dataItem.data
    const targetMessage = messages.find(msg => msg.id === imageData.messageId) as Message

    if (targetMessage && targetMessage.role === 'assistant') {
      const imageParts = imageData.images.map((img: any) => ({
        type: 'file' as const,
        mimeType: 'image/png',
        data: `data:image/png;base64,${img.base64}`
      }))

      if (!targetMessage.parts) {
        targetMessage.parts = []
      }
      targetMessage.parts = [...targetMessage.parts, ...imageParts]

      targetMessage.generationStartAt = imageData.generationStartAt
      targetMessage.generationEndAt = imageData.generationEndAt
      targetMessage.model = imageData.model

      chat.setMessages([...messages])
    }
  }

  return {
    // Chat state
    chat,
    
    // Configuration
    selectedModel,
    reasoningConfig,
    webSearchEnabled,
    imageGenerationConfig,
    
    // Attachments
    pendingAttachmentIds,
    pendingAttachmentData,
    submitWithAttachments,
    
    // Computed states
    isStreaming: computed(() => chat.status.value === 'streaming' || chat.status.value === 'submitted'),
  }
}