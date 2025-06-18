<script setup lang="ts">
import { useChat, type Message, type UseChatHelpers } from '@ai-sdk/vue'
import { useChatNavigation } from '~/composables/useChatNavigation'
import { useRouter } from 'vue-router'
import { defaultLLM, LLM_FEATURES } from '#shared/ai/LLM'
import { useAiStore } from '~/stores/ai'
import { useUserStore } from '~/stores/user'
import { useChatStore } from '~/stores/chat'
import { toast } from 'vue-sonner'
import { useI18n } from 'vue-i18n'
import type { UIMessage } from '~/types/chat'

const aiStore = useAiStore()
const userStore = useUserStore()
const chatStore = useChatStore()
const router = useRouter()
const route = useRoute()
const { getModelFromUrl } = useModelFromUrl()
const { t } = useI18n()
const { updateUrlToThread, syncRouterToCurrentUrl } = useChatNavigation()

const props = defineProps<{
    threadId?: string
}>()

// Template refs for child components
const chatInputForm = useTemplateRef('chatInputForm')
const chatMessages = useTemplateRef('chatMessages')

// Helper functions moved from useStoreHelpers
const findMessageIndex = (messages: UIMessage[], messageId: string): number => {
    return messages.findIndex(msg => msg.id === messageId)
}

// UI state  
let resizeObserver: ResizeObserver | null = null

// Error recovery state
const hasCheckedPendingStatus = ref(false)


// State to track if preferences are loaded
const preferencesLoaded = ref(false)

// Load user preferences on component mount
onMounted(async () => {
    // Set current thread in store
    chatStore.setCurrentThread(props.threadId || null)

    // Preferences are already loaded by the stores plugin during app initialization
    // No need to call loadPreferences() again
    preferencesLoaded.value = true

    // After loading preferences, check if we should use last selected model
    if (!getModelFromUrl() && userStore.preferences.lastSelectedModel) {
        const lastModel = userStore.preferences.lastSelectedModel

        if (lastModel && aiStore.llms[lastModel] && !aiStore.llms[lastModel].disabled) {
            const model = aiStore.llms[lastModel]
            if (userStore.isModelAvailable(model)) {
                selectedModel.value = lastModel
                aiStore.selectedModel = lastModel
            }
        }
    }    // Se abbiamo messaggi iniziali, assicurati che lo scroll vada in fondo dopo il mount
    if (initialMessages.length > 0) {
        await nextTick()
        setTimeout(() => {
            scrollToBottom()
        }, 200) // Timeout più lungo per assicurarsi che tutto sia renderizzato
    }

    // Handle initial message from command palette
    const handleInitialMessage = (event: CustomEvent) => {
        if (event.detail?.message && !props.threadId) {
            // Only handle on new chat pages (no threadId)
            nextTick(() => {
                chat.input.value = event.detail.message
                // Focus the input after setting the message
                const inputElement = document.querySelector('textarea[placeholder*="message"]') as HTMLTextAreaElement
                if (inputElement) {
                    inputElement.focus()
                    // Put cursor at the end
                    inputElement.setSelectionRange(inputElement.value.length, inputElement.value.length)
                }
            })
        }
    }

    window.addEventListener('sendInitialMessage', handleInitialMessage as EventListener)

    onUnmounted(() => {
        window.removeEventListener('sendInitialMessage', handleInitialMessage as EventListener)
    })
})

// Initialize selected model from URL parameter, last selected, or store
const getInitialModel = () => {
    const urlModel = getModelFromUrl()

    // First priority: URL model parameter
    if (urlModel && aiStore.llms[urlModel] && !aiStore.llms[urlModel].disabled) {
        const model = aiStore.llms[urlModel]
        if (userStore.isModelAvailable(model)) {
            return urlModel
        }
    }

    // Second priority: last selected model from preferences (will be loaded later)
    // We'll update this after preferences are loaded

    // Third priority: find first available model
    const accessibleModel = Object.keys(aiStore.llms).find(modelId => {
        const llm = aiStore.llms[modelId]
        return llm && !llm.disabled && userStore.isModelAvailable(llm)
    })

    return accessibleModel || aiStore.selectedModel || defaultLLM
}

const selectedModel = ref<string>(getInitialModel())


// Watch for selected model changes and save to preferences
watch(selectedModel, (newModel) => {
    if (newModel && preferencesLoaded.value) {
        aiStore.selectedModel = newModel
        userStore.saveLastSelectedModel(newModel)
    }
})

// Watch for model changes and reset reasoning config when provider changes
watch(selectedModel, (newModel, oldModel) => {
    if (newModel && oldModel && newModel !== oldModel) {
        const newModelInfo = aiStore.llms[newModel]
        const oldModelInfo = aiStore.llms[oldModel]

        // Reset reasoning config if provider changed
        if (newModelInfo?.provider !== oldModelInfo?.provider) {
            reasoningConfig.value = {}
        }
    }
})

// Watch for URL model changes
watch(() => route.query.model, (newModelId) => {
    if (newModelId && typeof newModelId === 'string' && aiStore.llms[newModelId] && !aiStore.llms[newModelId].disabled) {
        const model = aiStore.llms[newModelId]
        if (userStore.isModelAvailable(model)) {
            selectedModel.value = newModelId
            aiStore.selectedModel = newModelId
        } else {
            // Model not available, show warning and don't change selection
            toast.error(t('chat.model_requires_api_key', { model: model.name, provider: model.provider }))
        }
    }
})

// Watch for threadId changes and handle deletion
watch(() => props.threadId, async (newThreadId) => {
    // Update current thread in store
    chatStore.setCurrentThread(newThreadId || null)

    if (!newThreadId) {
        // If threadId becomes undefined (thread was deleted), redirect to home
        await router.push('/')
    }
})

// Load existing messages if threadId is provided
const initialMessages: Message[] = []
if (props.threadId) {
    const { data: threadData } = await useFetch(`/api/thread/${props.threadId}`)
    if (threadData.value && 'messages' in threadData.value) {
        const mappedMessages = threadData.value.messages.map((msg) => ({
            id: msg.id,
            role: msg.role,
            content: (msg.parts ?? []).reduce((acc, part) => {
                if (part.type === 'text') {
                    return acc + part.text
                } else if (part.type === 'reasoning') {
                    return acc + part.reasoning
                } return acc
            }, ''), model: msg.model,
            usage: msg.usage,
            generationStartAt: msg.generationStartAt,
            generationEndAt: msg.generationEndAt,
            parts: msg.parts
        })) as Message[]

        initialMessages.push(...mappedMessages)
    }
}

provide('selectedModel', selectedModel)

// Calculate messages that would be deleted for confirmation dialogs
const getMessagesAfterCount = (messageId: string): number => {
    const messageIndex = findMessageIndex(chat.messages.value as UIMessage[], messageId)
    if (messageIndex === -1) return 0
    return chat.messages.value.length - messageIndex - 1
}

// Check if streaming is active to prevent edit/retry operations
const isStreaming = computed(() => {
    return chat.status.value === 'streaming' || chat.status.value === 'submitted'
})

// Edit message handler - uses useChat setMessages to update the chat
// Nuovo approccio: utilizziamo sempre useChat.setMessages() per gestire i messaggi
// Il backend riceve sempre l'intera conversazione e la sincronizza con il database
const handleEditMessage = async (messageId: string, newText: string) => {
    // Prevent edit during streaming
    if (isStreaming.value) {
        toast.error(t('chat.cannot_edit_during_streaming'))
        return
    }

    try {
        const message = chat.messages.value.find(msg => msg.id === messageId) as UIMessage
        if (!message || message.role !== 'user') {
            toast.error(t('message_not_found'))
            return
        }

        const messageIndex = findMessageIndex(chat.messages.value as UIMessage[], messageId)
        if (messageIndex === -1) return

        // Keep messages up to the edit point (excluding the message being edited)
        const messagesToKeep = chat.messages.value.slice(0, messageIndex)

        // Update messages in useChat
        chat.setMessages(messagesToKeep)

        // Set the new text and submit
        chat.input.value = newText
        await nextTick()

        // Submit the edited message - useChat will handle the streaming
        chat.handleSubmit()

        toast.success(t('edit_message'))
    } catch (error) {
        console.error('Error editing message:', error)
        toast.error(t('chat.chat_error_message', { message: 'Failed to edit message' }))
    }
}

// Retry message handler - uses useChat setMessages to update the chat
// Supporta sia retry di messaggi utente che di messaggi assistente
const handleRetryMessage = async (messageId: string, newModelId?: string) => {
    // Prevent retry during streaming
    if (isStreaming.value) {
        toast.error(t('chat.cannot_retry_during_streaming'))
        return
    }

    try {
        // Change model if specified
        if (newModelId && newModelId !== selectedModel.value) {
            selectedModel.value = newModelId
            aiStore.selectedModel = newModelId
            await nextTick()
        }

        const message = chat.messages.value.find(msg => msg.id === messageId) as UIMessage
        if (!message) {
            toast.error(t('message_not_found'))
            return
        } let userMessageContent = ''
        let targetMessageIndex = -1
        let messageAttachmentIds: string[] = []

        if (message.role === 'assistant') {
            // For assistant messages, find the previous user message
            const messageIndex = findMessageIndex(chat.messages.value as UIMessage[], messageId)
            const userMessages = chat.messages.value.slice(0, messageIndex).filter(msg => msg.role === 'user')
            const lastUserMessage = userMessages[userMessages.length - 1]

            if (!lastUserMessage) {
                toast.error(t('chat.no_user_message_found'))
                return
            }

            userMessageContent = lastUserMessage.content || ''
            targetMessageIndex = findMessageIndex(chat.messages.value as UIMessage[], lastUserMessage.id)

            // Get attachment IDs for the user message if it has file parts
            if (lastUserMessage.parts?.some(part => part.type === 'file')) {
                try {
                    const response = await $fetch<{ attachmentIds: string[] }>(`/api/message/${lastUserMessage.id}/attachments`)
                    messageAttachmentIds = response.attachmentIds || []
                } catch (error) {
                    console.error('Error fetching message attachments:', error)
                    // Continue without attachments rather than failing
                }
            }
        } else {
            // For user messages, use the message content directly
            userMessageContent = message.content || ''
            targetMessageIndex = findMessageIndex(chat.messages.value as UIMessage[], messageId)

            // Get attachment IDs for the message if it has file parts
            if (message.parts?.some(part => part.type === 'file')) {
                try {
                    const response = await $fetch<{ attachmentIds: string[] }>(`/api/message/${message.id}/attachments`)
                    messageAttachmentIds = response.attachmentIds || []
                } catch (error) {
                    console.error('Error fetching message attachments:', error)
                    // Continue without attachments rather than failing
                }
            }
        }

        if (!userMessageContent || targetMessageIndex === -1) {
            toast.error(t('chat.no_user_message_found'))
            return
        }

        // Keep messages up to the retry point (excluding messages after the target)
        const messagesToKeep = chat.messages.value.slice(0, targetMessageIndex)

        // Update messages in useChat
        chat.setMessages(messagesToKeep)

        // Set the content and attachment IDs
        chat.input.value = userMessageContent
        // Set attachment IDs if we have any
        if (messageAttachmentIds.length > 0) {
            pendingAttachmentIds.value = messageAttachmentIds

            // Also populate the upload form with attachment info for UI display
            try {
                const response = await $fetch<{ attachments: { id: string; fileName: string; fileSize: number; mimeType: string }[] }>(`/api/attachments/details`, {
                    method: 'POST',
                    body: { attachmentIds: messageAttachmentIds }
                });

                const uploadedAttachments = inject('uploadedAttachments') as Ref<{ id: string; name: string; size: number; type: string }[]> | undefined
                if (uploadedAttachments && response.attachments.length > 0) {
                    uploadedAttachments.value = response.attachments.map(att => ({
                        id: att.id,
                        name: att.fileName,
                        size: att.fileSize,
                        type: att.mimeType
                    }))
                }
            } catch (error) {
                console.error('Error loading attachment details for retry:', error)
            }
        }

        await nextTick()

        // Submit the retry - useChat will handle the streaming
        chat.handleSubmit()

        toast.success(t('retry_message'))
    } catch (error) {
        console.error('Error retrying message:', error)
        toast.error(t('chat.chat_error_message', { message: 'Failed to retry message' }))
    }
}

// Reasoning configuration
const reasoningConfig = ref<{
    openai?: {
        reasoningEffort?: 'low' | 'medium' | 'high'
    }
    anthropic?: {
        thinking?: {
            type?: 'enabled'
            budgetTokens?: number
        }
    }
    google?: {
        includeThoughts?: boolean
        thinkingBudget?: number
    }
}>({})

// Web search configuration
const webSearchEnabled = ref(false)

// Image generation configuration
const imageGenerationConfig = ref<{
    n?: number
    size?: '1024x1024' | '1536x1024' | '1024x1536' | 'auto'
    openai?: {
        quality?: 'auto' | 'high' | 'medium' | 'low'
        background?: 'auto' | 'transparent' | 'opaque'
        output_format?: 'png' | 'jpeg' | 'webp'
        output_compression?: number
        moderation?: 'auto' | 'low'
    }
}>({
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

// Attachment IDs for the current message being submitted
const pendingAttachmentIds = ref<string[]>([])
const pendingAttachmentData = ref<{ id: string; name: string; size: number; type: string; data?: string }[]>([])

provide('reasoningConfig', reasoningConfig)
provide('webSearchEnabled', webSearchEnabled)
provide('imageGenerationConfig', imageGenerationConfig)

// Provide function to submit message with attachments
const submitWithAttachments = (attachmentIds: string[], attachmentData?: { id: string; name: string; size: number; type: string; data?: string }[]) => {
    pendingAttachmentIds.value = attachmentIds
    pendingAttachmentData.value = attachmentData || []
}
provide('submitWithAttachments', submitWithAttachments)

// Centralized chat logic - simplified configuration
const chat = useChat({
    id: props.threadId,
    api: `/api/chat`,
    initialMessages: initialMessages, body: computed(() => {
        const selectedModelInfo = aiStore.llms[selectedModel.value]
        const apiKeys = selectedModelInfo ? userStore.getApiKeyForModel(selectedModelInfo) : undefined        // Build model params with web search configuration
        const modelParams: any = { ...reasoningConfig.value }

        // Add web search parameter if enabled
        if (webSearchEnabled.value) {
            modelParams.webSearch = true
        }        // Add image generation parameters if model supports images
        const isImageModel = selectedModelInfo?.features.includes(LLM_FEATURES.IMAGES)
        if (isImageModel && imageGenerationConfig.value) {
            modelParams.imageGeneration = imageGenerationConfig.value
        }

        return {
            model: selectedModel.value,
            modelParams,
            threadMetadata: {
                id: props.threadId
            },
            userInfo: {
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
            },
            preferences: {
                name: userStore.preferences.name || '',
                occupation: userStore.preferences.occupation || '',
                selectedTraits: userStore.preferences.selectedTraits || [],
                additionalInfo: userStore.preferences.additionalInfo || '',
            },
            apiKeys: apiKeys,
            attachmentIds: pendingAttachmentIds.value.length > 0 ? pendingAttachmentIds.value : undefined,
        }
    }), async onFinish(_message, { finishReason: _finishReason, usage: _usage }) {
        // Clear pending attachment IDs and data after message is sent
        pendingAttachmentIds.value = []
        pendingAttachmentData.value = []

        // Update current thread status to completed
        if (props.threadId) {
            const currentThread = chatStore.threads.find(t => t.id === props.threadId)
            if (currentThread && (currentThread.generationStatus === 'pending' || currentThread.generationStatus === 'generating')) {
                // Update thread status locally first for immediate UI update
                currentThread.generationStatus = 'completed'
            }
        }        // Sync router with current URL after streaming completes
        syncRouterToCurrentUrl()

        // Refresh threads only if we're creating a new thread (no existing threadId)
        // If we're already in an existing thread, no need to refresh the threads list
        if (!props.threadId) {
            await chatStore.loadThreads()
        }
    },
    onError(error) {
        console.error('Chat error:', error)
        const errorMessage = error?.message || 'Unknown error'

        toast.error(t('chat.chat_error_message', { message: errorMessage }), {
            action: {
                label: t('chat.try_again'),
                onClick: () => {
                    const lastUserMessage = [...chat.messages.value].reverse().find(msg => msg.role === 'user')
                    if (lastUserMessage) {
                        handleRetryMessage(lastUserMessage.id)
                    } else if (chat.input.value.trim()) {
                        chat.handleSubmit()
                    }
                }
            },
            duration: 10000
        })
    }
})

// Watch for new user messages and immediately add attachment parts
const lastMessageCount = ref(0)
watchEffect(() => {
    const currentMessages = chat.messages.value

    // Check if new messages were added
    if (currentMessages.length > lastMessageCount.value) {
        lastMessageCount.value = currentMessages.length

        // Check if the last message is a user message with pending attachments
        const lastMessage = currentMessages[currentMessages.length - 1]
        if (lastMessage && lastMessage.role === 'user' && pendingAttachmentData.value.length > 0) {
            // Convert attachment data to FileUIPart format
            const attachmentParts = pendingAttachmentData.value.map(attachment => ({
                type: 'file' as const,
                mimeType: attachment.type,
                data: attachment.data || ''
            })).filter(part => part.data) // Only include attachments with data

            // Add attachment parts to the message
            if (attachmentParts.length > 0) {
                if (!lastMessage.parts) {
                    lastMessage.parts = []
                }
                lastMessage.parts.push(...attachmentParts)
            }
            // Clear pending attachment data
            pendingAttachmentData.value = []
            pendingAttachmentIds.value = []
        }
    }
})

watchEffect(() => {
    if (!chat.data?.value)
        return

    // Check for threadId in data stream
    for (const dataItem of chat.data.value) {
        if (dataItem && typeof dataItem === 'object') {
            if ('threadId' in dataItem) {
                const newThreadId = (dataItem as { threadId: string }).threadId
                if (newThreadId && newThreadId !== props.threadId) {
                    // Update URL during streaming - only update browser URL, not router
                    updateUrlToThread(newThreadId, true)
                }
            } else if ('type' in dataItem && dataItem.type === 'metrics') {
                const metrics = (dataItem as { data: { tokensPerSecond: number, promptTokens: number, completionTokens: number, totalTokens: number, generationStartAt: number, generationEndAt: number, model: string, messageId: string } }).data

                // Find the specific message by messageId instead of assuming it's the last one
                const targetMessage = chat.messages.value.find(msg =>
                    msg.id === metrics.messageId ||
                    (msg.role === 'assistant' && chat.messages.value.indexOf(msg) === chat.messages.value.length - 1)
                ) as UIMessage

                if (targetMessage && targetMessage.role === 'assistant') {

                    // Update usage field
                    if (!targetMessage.usage) targetMessage.usage = {}

                    targetMessage.usage.promptTokens = metrics.promptTokens
                    targetMessage.usage.completionTokens = metrics.completionTokens
                    targetMessage.usage.totalTokens = metrics.totalTokens
                    targetMessage.generationStartAt = metrics.generationStartAt
                    targetMessage.generationEndAt = metrics.generationEndAt
                    targetMessage.model = metrics.model  // Update model in real-time

                    // Update message ID if provided
                    if (metrics.messageId && targetMessage.id !== metrics.messageId) {
                        targetMessage.id = metrics.messageId
                    }
                } else {
                    console.warn('⚠️ Could not find target message for metrics:', metrics.messageId);
                }
            } else if ('type' in dataItem && dataItem.type === 'images') {
                const imageData = (dataItem as { data: { images: { base64: string, url?: string }[], messageId: string, model: string, generationStartAt: number, generationEndAt: number, responseTime: number } }).data

                // Find the target message by messageId
                const targetMessage = chat.messages.value.find(msg => msg.id === imageData.messageId) as UIMessage

                if (targetMessage && targetMessage.role === 'assistant') {
                    // Add images to the message parts instead of the legacy images array
                    const imageParts = imageData.images.map((img) => ({
                        type: 'file' as const,
                        mimeType: 'image/png',
                        data: `data:image/png;base64,${img.base64}`
                    }))

                    // Update or add the parts to the message (force reactivity)
                    if (!targetMessage.parts) {
                        targetMessage.parts = []
                    }
                    // Replace the array to trigger reactivity
                    targetMessage.parts = [...targetMessage.parts, ...imageParts]

                    // Update timing information
                    targetMessage.generationStartAt = imageData.generationStartAt
                    targetMessage.generationEndAt = imageData.generationEndAt
                    targetMessage.model = imageData.model

                    // Force reactivity on the messages array
                    chat.setMessages([...chat.messages.value])

                    console.log('✅ Images added to message parts:', targetMessage.id, imageParts.length, 'images')
                } else {
                    console.warn('⚠️ Could not find target message for images:', imageData.messageId);
                }
            }
        }
    }
})

// Provide chat state and helper functions to child components
provide<UseChatHelpers>('chatState', chat)
provide('getMessagesAfterCount', getMessagesAfterCount)
provide('isStreaming', isStreaming)

// Scroll to bottom functionality exposed to child components
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

// Provide scroll functionality to InputForm
provide('scrollToBottom', scrollToBottom)
provide('showScrollToBottom', showScrollToBottom)
provide('preferencesLoaded', preferencesLoaded)

const updatePadding = () => {
    if (chatInputForm.value && chatMessages.value) {
        // Try to get the DOM element from the component ref
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

        // Get the DOM element from the component ref
        const formElement = chatInputForm.value.$el || chatInputForm.value
        if (formElement && formElement instanceof Element) {
            resizeObserver.observe(formElement)
        }
    }
})

// Check for pending thread status and add error message when both threads and initial messages are loaded
const checkForErrorMessage = async () => {
    if (!props.threadId || hasCheckedPendingStatus.value) return

    const currentThread = chatStore.threads.find(t => t.id === props.threadId)
    if (!currentThread) return

    if (currentThread.generationStatus === 'pending' || currentThread.generationStatus === 'generating') {
        console.log(`Found thread in ${currentThread.generationStatus} state, adding error message...`)

        // Wait a bit more for messages to be loaded
        await new Promise(resolve => setTimeout(resolve, 500))

        // Check if we need to add an error message
        const lastMessage = chat.messages.value[chat.messages.value.length - 1]
        console.log('Last message:', lastMessage)
        console.log('Thread status:', currentThread.generationStatus)
        console.log('Total messages:', chat.messages.value.length)

        const needsErrorMessage = !lastMessage ||
            (lastMessage.role === 'user' && (currentThread.generationStatus === 'pending' || currentThread.generationStatus === 'generating')) ||
            (lastMessage.role === 'assistant' && !lastMessage.content && currentThread.generationStatus === 'generating')

        console.log('Needs error message?', needsErrorMessage, {
            noLastMessage: !lastMessage,
            userAndPendingOrGenerating: lastMessage?.role === 'user' && (currentThread.generationStatus === 'pending' || currentThread.generationStatus === 'generating'),
            assistantEmptyAndGenerating: lastMessage?.role === 'assistant' && !lastMessage?.content && currentThread.generationStatus === 'generating'
        })

        if (needsErrorMessage) {
            // Check if error message already exists
            const hasExistingError = chat.messages.value.some(msg => (msg as UIMessage).isError)
            if (hasExistingError) {
                console.log('Error message already exists, skipping...')
                return
            }

            console.log('Creating error message for thread status:', currentThread.generationStatus)

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

            // Add error message to chat
            const newMessages = [...chat.messages.value, errorMessage]
            console.log('Setting new messages with error:', newMessages.length, errorMessage)
            chat.setMessages(newMessages)

            await nextTick()
            console.log('Messages after setting:', chat.messages.value.length)
        }
    }

    hasCheckedPendingStatus.value = true
}

// Watch for both threads and messages to be loaded
watch([() => chatStore.threads.length, () => chat.messages.value.length], async () => {
    if (chatStore.threads.length > 0) {
        await checkForErrorMessage()
    }
}, { immediate: true })

// Also try after component mount
onMounted(async () => {
    await new Promise(resolve => setTimeout(resolve, 1000))
    await checkForErrorMessage()
})

onUnmounted(() => {
    if (resizeObserver) resizeObserver.disconnect()
})
</script>

<template>
    <div class="absolute top-0 bottom-0 w-full">
        <ChatInputForm ref="chatInputForm" :thread-id="threadId" />
        <ChatMessages ref="chatMessages" @edit-message="handleEditMessage" @retry-message="handleRetryMessage" />
    </div>
</template>