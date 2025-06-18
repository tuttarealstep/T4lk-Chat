<script setup lang="ts">
import type { DefineComponent } from 'vue'
import type { UIMessage } from '~/types/chat'
import type { UseChatHelpers } from '@ai-sdk/vue'
import ProsePreStream from '../prose/ProsePreStream.vue'
import { useI18n } from 'vue-i18n'

// Define props
const props = defineProps<{
    readOnly?: boolean
}>()

// Define emits for message operations
const emit = defineEmits<{
    'edit-message': [messageId: string, newText: string]
    'retry-message': [messageId: string, modelId?: string]
}>()

// Inject chat state from parent component
const chatState = inject('chatState') as UseChatHelpers
const { t } = useI18n()

if (!chatState) {
    throw new Error('ChatMessages must be used within a Chat component')
}

const { messages, status } = chatState

// Refs
const scrollContainer = ref<HTMLElement>()
const chatMessages = ref<HTMLElement>()

// State for scroll behavior
const isUserAtBottom = ref(true)
const isAutoScrolling = ref(false)
const autoScrollPaused = ref(false) // Pausa auto-scroll se l'utente scrolla durante streaming
const scrollDimensionsKey = ref(0) // For forcing reactivity
const scrollTimeout = ref<NodeJS.Timeout | null>(null)

// Check if user is at the bottom of the scroll container
const checkIfAtBottom = () => {
    if (!scrollContainer.value) return false

    const { scrollTop, scrollHeight, clientHeight } = scrollContainer.value
    const threshold = 50 // pixels threshold

    return scrollHeight - scrollTop - clientHeight <= threshold
}

// Check if container has scrollable content
const hasScrollableContent = computed(() => {
    // Force reactivity by depending on scrollDimensionsKey
    void scrollDimensionsKey.value

    if (!scrollContainer.value) {
        console.log('No scroll container ref')
        return false
    }
    const { scrollHeight, clientHeight } = scrollContainer.value
    const isScrollable = scrollHeight > clientHeight

    return isScrollable
})

// Force update of scroll dimensions
const updateScrollDimensions = () => {
    scrollDimensionsKey.value++
}

// Determine if scroll to bottom button should be shown
const shouldShowScrollButton = computed(() => {
    // Condizioni per mostrare il bottone:
    // 1. Ci sono messaggi
    // 2. Il container ha contenuto scrollabile
    // 3. L'utente non è in fondo al container
    const hasMessages = !!(messages.value && messages.value.length > 0)
    const hasScrollable = hasScrollableContent.value
    const notAtBottom = !isUserAtBottom.value

    const shouldShow = hasMessages && hasScrollable && notAtBottom

    return shouldShow
})

// Scroll to bottom function
const scrollToBottom = (smooth = true) => {
    if (!scrollContainer.value) return

    isAutoScrolling.value = true
    scrollContainer.value.scrollTo({
        top: scrollContainer.value.scrollHeight,
        behavior: smooth ? 'smooth' : 'instant'
    })

    // Reset auto scrolling flag after animation
    setTimeout(() => {
        isAutoScrolling.value = false
    }, 100)
}

// Handle scroll events - refactored for better logic
const handleScroll = () => {
    if (isAutoScrolling.value) return

    const atBottom = checkIfAtBottom()
    isUserAtBottom.value = atBottom

    // Clear existing timeout
    if (scrollTimeout.value) {
        clearTimeout(scrollTimeout.value)
        scrollTimeout.value = null
    }

    // Se l'utente torna in fondo manualmente, riabilita immediatamente l'auto-scroll
    if (atBottom && autoScrollPaused.value) {
        autoScrollPaused.value = false
    }    // Se l'utente scrolla via dal fondo durante lo streaming, aspetta un po' prima di mettere in pausa
    // Questo evita che scroll accidentali o veloci attivino la pausa
    if (!atBottom && (status.value === 'streaming' || status.value === 'submitted')) {
        scrollTimeout.value = setTimeout(() => {
            // Verifica di nuovo se l'utente è ancora lontano dal fondo
            if (!checkIfAtBottom() && (status.value === 'streaming' || status.value === 'submitted')) {
                autoScrollPaused.value = true
            }
            scrollTimeout.value = null
        }, 200) // Ridotto a 200ms per essere più reattivo
    }

    // Force update scroll dimensions to ensure computed is reactive
    updateScrollDimensions()
}

// Watch for new messages and streaming status
watch([messages, status], (newValues, oldValues) => {
    nextTick(() => {
        // Force update scroll dimensions first
        updateScrollDimensions()

        // Update scroll button visibility based on current scroll position
        handleScroll()

        const [newMessages, newStatus] = newValues
        const [oldMessages, oldStatus] = oldValues || [[], 'idle']

        // Auto-scroll logic migliorata
        const hasNewMessages = newMessages && oldMessages && newMessages.length > oldMessages.length
        const isStreamingOrSubmitted = newStatus === 'streaming' || newStatus === 'submitted'
        const wasStreaming = oldStatus === 'streaming' || oldStatus === 'submitted'
        const streamingJustEnded = wasStreaming && newStatus !== 'streaming' && newStatus !== 'submitted'
        const streamingJustStarted = !wasStreaming && isStreamingOrSubmitted

        // Se lo streaming è appena iniziato o ci sono nuovi messaggi, riabilita l'auto-scroll e scrolla subito
        if (streamingJustStarted || hasNewMessages) {
            autoScrollPaused.value = false
            scrollToBottom(true) // Scroll immediato per nuovi messaggi
        }

        // Durante lo streaming, scrolla solo se l'utente è in fondo e l'auto-scroll non è in pausa
        const isStreamingAndPaused = isStreamingOrSubmitted && autoScrollPaused.value
        const shouldAutoScroll = isUserAtBottom.value && !isStreamingAndPaused

        if (shouldAutoScroll && isStreamingOrSubmitted && !streamingJustStarted) {
            // Durante lo streaming, scroll smooth per seguire il contenuto
            scrollToBottom(true)
        }

        // Se lo streaming è appena terminato, riabilita l'auto-scroll per future interazioni
        if (streamingJustEnded) {
            autoScrollPaused.value = false
        }
    })
}, { deep: true })

// Initial scroll to bottom on mount
onMounted(() => {
    nextTick(() => {
        scrollToBottom(false) // Instant scroll on initial load
        updateScrollDimensions() // Force update dimensions
        handleScroll() // Initialize button state
    })
})

// Watch for initial messages load and ensure scroll to bottom
watch(() => messages.value?.length, (newLength, oldLength) => {
    // Se è il primo caricamento di messaggi (da 0 a qualcosa) o aumentano significativamente
    if (oldLength === 0 && newLength > 0) {
        nextTick(() => {
            // Aspetta un po' per il rendering completo, poi scrolla
            setTimeout(() => {
                scrollToBottom(false) // Scroll immediato senza animazione
                isUserAtBottom.value = true // Forza lo stato "in fondo"
                updateScrollDimensions()
                handleScroll()
            }, 100)
        })
    } else if (newLength && oldLength && newLength > oldLength) {
        // Per edit/retry, ricontrolla immediatamente la visibilità del pulsante scroll
        nextTick(() => {
            updateScrollDimensions()
            handleScroll()
        })
    }
}, { immediate: true })

const mdcComponents = {
    pre: ProsePreStream as unknown as DefineComponent
}

// Message operation handlers
const handleEditMessage = (messageId: string, newText: string) => {
    emit('edit-message', messageId, newText)
}

const handleRetryMessage = (messageId: string, modelId?: string) => {
    emit('retry-message', messageId, modelId)
}

// Expose functions to parent component
defineExpose({
    scrollToBottom,
    showScrollToBottom: shouldShowScrollButton
})

// Add scroll event listener and resize observer
onMounted(() => {
    if (scrollContainer.value) {
        scrollContainer.value.addEventListener('scroll', handleScroll, { passive: true })
        // Add ResizeObserver to handle container size changes
        const resizeObserver = new ResizeObserver(() => {
            nextTick(() => {
                updateScrollDimensions()
                handleScroll()
            })
        })

        // Ensure we have a valid Element before observing
        if (scrollContainer.value instanceof Element) {
            resizeObserver.observe(scrollContainer.value)
        }

        // Store cleanup function
        onUnmounted(() => {
            resizeObserver.disconnect()
        })
    }
})

onUnmounted(() => {
    if (scrollContainer.value) {
        scrollContainer.value.removeEventListener('scroll', handleScroll)
    }

    // Clean up scroll timeout
    if (scrollTimeout.value) {
        clearTimeout(scrollTimeout.value)
        scrollTimeout.value = null
    }
})
</script>

<template>
    <div ref="scrollContainer" class="absolute inset-0 overflow-y-scroll sm:pt-3.5"
        style="scrollbar-gutter: stable both-edges;">
        <div ref="chatMessages" aria-label="Chat messages"
            class="mx-auto flex w-full max-w-3xl flex-col space-y-12 px-4 pb-10 pt-safe-offset-10">
            <!-- Welcome message when no messages -->
            <ChatWelkomeMessage v-if="!messages || messages.length === 0" /> <!-- Chat messages -->
            <ClientOnly>
                <div v-for="(message, index) in messages" :key="message.id">
                    <ChatMessage :message="message as UIMessage" :is-last-message="index === messages.length - 1"
                        :read-only="props.readOnly" @edit-message="handleEditMessage"
                        @retry-message="handleRetryMessage">
                        <template #content="{ message: slotMessage, isLastMessage: slotIsLastMessage }">
                            <MDCCached :value="slotMessage.content" :cache-key="slotMessage.id" unwrap="p"
                                :components="mdcComponents" :parser-options="{ highlight: false }" />

                            <div v-if="slotMessage.role === 'assistant' && status === 'submitted' && slotIsLastMessage">
                                <div class="h-6 flex items-center gap-1 py-3">
                                    <span class="size-2 rounded-full bg-secondary-foreground animate-bounce" />
                                    <span
                                        class="size-2 rounded-full bg-secondary-foreground animate-bounce [animation-delay:0.2s]" />
                                    <span
                                        class="size-2 rounded-full bg-secondary-foreground animate-bounce [animation-delay:0.4s]" />
                                </div>
                            </div>

                            <div v-if="slotMessage.role === 'assistant' && status === 'streaming' && slotIsLastMessage">
                                <Icon name="lucide:loader" class="size-4 animate-spin text-secondary-foreground" />
                            </div>
                        </template>
                    </ChatMessage>
                </div>
            </ClientOnly>

            <!-- Error message -->
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

            <!-- Loading indicator -->
            <!-- <ChatMessage v-if="status === 'submitted' || status === 'streaming'"
                :message="{ id: 'loading', role: 'assistant', content: '', parts: [] }">
                <template #content>
                    <div class="h-6 flex items-center gap-1 py-3">
                        <span class="size-2 rounded-full bg-secondary-foregound animate-bounce">
                        </span>
                        <span class="size-2 rounded-full bg-secondary-foreground animate-bounce [animation-delay:0.2s]">
                        </span>
                        <span class="size-2 rounded-full bg-secondary-foreground animate-bounce [animation-delay:0.4s]">
                        </span>
                    </div>
                </template>            </ChatMessage>-->
        </div>
    </div>
</template>