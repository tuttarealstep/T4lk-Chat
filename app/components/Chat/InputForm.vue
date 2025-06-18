<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import { useAiStore } from '~/stores/ai'
import { toast } from 'vue-sonner'
import { validateMessageLength } from '~/utils/messageValidation'
import type { UseChatHelpers } from '@ai-sdk/vue'
import type { LLM_PROVIDERS } from '#shared/ai/LLM';
import { LLM_FEATURES } from '#shared/ai/LLM'

const { t } = useI18n()

// Stores
const aiStore = useAiStore()
const userStore = useUserStore()

// Inject chat state from parent component
const chatState = inject('chatState') as UseChatHelpers | undefined

if (!chatState) {
    throw new Error('ChatInputForm must be used within a Chat component')
}

const { input, stop, status, handleSubmit } = chatState

const chatInputForm = useTemplateRef('chatInputForm')
const chatInput = useTemplateRef('chatInput')

// Props for thread ID
const props = defineProps<{
    threadId?: string
}>()

// Draft management
const draftKey = computed(() => props.threadId ? `chat-draft-${props.threadId}` : 'chat-draft-new')

// Save draft to localStorage
const saveDraft = (content: string) => {
    if (import.meta.client) {
        if (content.trim()) {
            localStorage.setItem(draftKey.value, content)
        } else {
            localStorage.removeItem(draftKey.value)
        }
    }
}

// Load draft from localStorage
const loadDraft = () => {
    if (import.meta.client) {
        const saved = localStorage.getItem(draftKey.value)
        if (saved && !input.value) {
            input.value = saved
            nextTick(() => {
                computeTextareaHeight()
            })
        }
    }
}

// Clear draft from localStorage
const clearDraft = () => {
    if (import.meta.client) {
        localStorage.removeItem(draftKey.value)
    }
}

// Inject scroll functionality from parent
const scrollToBottom = inject('scrollToBottom') as (() => void) | undefined
const showScrollToBottom = inject('showScrollToBottom') as ComputedRef<boolean> | undefined
const preferencesLoaded = inject('preferencesLoaded') as Ref<boolean> | undefined

const computeTextareaHeight = () => {
    const textarea = chatInput.value as HTMLTextAreaElement
    if (!textarea) return

    // Reset height to get accurate scrollHeight
    textarea.style.height = 'auto'

    // Calculate new height based on content
    const scrollHeight = textarea.scrollHeight
    const minHeight = 48 // minimum height in pixels
    const maxHeight = 240 // maximum height in pixels

    // Set height between min and max
    const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight)
    textarea.style.height = `${newHeight}px`

    // Enable/disable scroll based on content height
    if (scrollHeight > maxHeight) {
        textarea.style.overflowY = 'auto'
    } else {
        textarea.style.overflowY = 'hidden'
    }

    //Scroll to bottom if the textarea is focused
    if (document.activeElement === textarea) {
        textarea.scrollTop = textarea.scrollHeight
    }
}

const selectedModel = inject('selectedModel') as Ref<string> | undefined
const isPopoverModelSelectionOpen = ref(false)

// Handle model selection
const handleModelSelected = () => {
    isPopoverModelSelectionOpen.value = false
}

// Get the display name for the selected model - using reactive reference
const selectedModelInfo = computed(() => {
    // Force re-evaluation when model availability changes
    void aiStore.modelAvailabilityTrigger

    if (!selectedModel?.value) return null
    return aiStore.getModelsWithCredentials.find(model => model.modelKey === selectedModel.value)
})

// Handle API keys updates to refresh model availability
const handleApiKeysUpdate = async (event: StorageEvent) => {
    if (event.key === 'userApiKeys') {
        // Force refresh of models with credentials
        aiStore.refreshModelAvailability()

        // Also refresh user store to ensure API keys are loaded
        userStore.loadApiKeys()
        // Force re-evaluation of server config
        await userStore.loadServerConfig(true)

        // Force re-evaluation with nextTick
        await nextTick()
    }
}

const selectedModelDisplayName = computed(() => {
    return selectedModelInfo.value?.name || t('chat.select_model')
})

// Check if model is selected and accessible for form validation
const isModelSelected = computed(() => {
    return Boolean(selectedModel?.value && selectedModelInfo.value?.hasCredentials)
})

// Check if selected model supports reasoning effort
const supportsReasoningEffort = computed(() => {
    const hasReasoning = selectedModelInfo.value?.features.includes(LLM_FEATURES.REASONING) || false
    const hasReasoningEffort = selectedModelInfo.value?.features.includes(LLM_FEATURES.REASONING_EFFORT) || false
    const supports = hasReasoning || hasReasoningEffort
    return supports
})

// Check if selected model supports web search
const supportsWebSearch = computed(() => {
    return selectedModelInfo.value?.features.includes(LLM_FEATURES.SEARCH) || false
})

const reasoningConfig = inject('reasoningConfig')
const webSearchEnabled = inject('webSearchEnabled') as Ref<boolean> | undefined
const imageGenerationConfig = inject('imageGenerationConfig')
const submitWithAttachments = inject('submitWithAttachments') as ((attachmentIds: string[], attachmentData?: { id: string; name: string; size: number; type: string; data?: string }[]) => void) | undefined

// Check if selected model supports images

const supportsImages = computed(() => {
    return selectedModelInfo.value?.features.includes(LLM_FEATURES.IMAGES) || false
})

// Check if selected model supports attachments (PDFs or vision)
const supportsAttachments = computed(() => {
    const supportsPdfs = selectedModelInfo.value?.features.includes(LLM_FEATURES.PDFS) || false
    const supportsVision = selectedModelInfo.value?.features.includes(LLM_FEATURES.VISION) || false
    return supportsPdfs || supportsVision
})

const attachments = ref<File[]>([])
const uploadedAttachments = ref<{ id: string; name: string; size: number; type: string; data?: string }[]>([])
provide('attachments', attachments)
provide('uploadedAttachments', uploadedAttachments)

const handleFormSubmit = async () => {
    if (!preferencesLoaded?.value) {
        toast.error(t('chat.loading_preferences'))
        return
    }
    if (!selectedModel?.value) {
        toast.error(t('chat.model_required'))
        return
    }

    if (!selectedModelInfo.value?.hasCredentials) {
        toast.error(t('chat.model_requires_api_key', {
            model: selectedModelInfo.value?.name || 'Unknown',
            provider: selectedModelInfo.value?.provider || 'Unknown'
        }))
        return
    }

    if (chatState.status.value === 'streaming') {
        toast.error(t('chat.cancel_streaming_first'))
        return
    }

    // Check if we have either text or attachments
    const hasText = input.value.trim()
    const hasAttachments = uploadedAttachments.value.length > 0

    if (!hasText && !hasAttachments) {
        toast.error(t('chat.message_requires_content'))
        return
    }

    // Validate message length if there's text
    if (hasText) {
        const validation = validateMessageLength(input.value.trim(), selectedModel.value)
        if (!validation.valid) {
            toast.error(t('message_too_long', { current: validation.current, max: validation.max }))
            return
        }
    }

    // Clear draft before submitting
    clearDraft()

    // Get attachment IDs from already uploaded attachments
    const attachmentIds = uploadedAttachments.value.map(att => att.id)

    // Keep a copy of attachment data before clearing
    const attachmentData = [...uploadedAttachments.value]

    // Clear uploaded attachments from UI after getting IDs
    uploadedAttachments.value = []

    // Store attachment IDs and data for the next submit
    if (attachmentIds.length > 0 && submitWithAttachments) {
        submitWithAttachments(attachmentIds, attachmentData)
    }

    // If we have only attachments and no text, put a placeholder text
    // This ensures useChat will send the request
    const originalInput = input.value
    const needsPlaceholder = !hasText && hasAttachments

    if (needsPlaceholder) {
        input.value = ' ' // Put a space to trigger the submit
    }

    // Submit the message using useChat
    await handleSubmit()

    // If we used a placeholder, clear it after submission
    if (needsPlaceholder) {
        input.value = originalInput
    }
}

// Watch input changes to save draft
watch(input, (newValue) => {
    saveDraft(newValue)
}, { immediate: false })

// Watch for API keys changes to ensure model availability is updated
watch(() => userStore.apiKeys, () => {
    // Force refresh when API keys change
    aiStore.refreshModelAvailability()
}, { deep: true })

// Watch for server config changes
watch(() => userStore.serverConfig, () => {
    // Force refresh when server config changes
    aiStore.refreshModelAvailability()
}, { deep: true })

// Initialize component on mount and setup listeners
onMounted(() => {
    // Setup API keys listener
    window.addEventListener('storage', handleApiKeysUpdate)

    // Initialize textarea height and load draft
    if (chatInput.value) {
        computeTextareaHeight()
    }
    loadDraft()
})

// Cleanup listeners on unmount
onUnmounted(() => {
    window.removeEventListener('storage', handleApiKeysUpdate)
})

// Watch for model changes and clear attachments if new model doesn't support them
watch(supportsAttachments, (newSupports, oldSupports) => {
    // If model was changed to one that doesn't support attachments, clear them
    if (oldSupports && !newSupports && uploadedAttachments.value.length > 0) {
        uploadedAttachments.value = []
        toast.info(t('chat.attachments_cleared_model_unsupported'))
    }
})

const isUploading = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

function triggerFileInput() {
    fileInputRef.value?.click()
}

async function handleFileChange(e: Event) {
    const files = (e.target as HTMLInputElement).files
    if (!files || !files.length) return
    await uploadFiles(Array.from(files))
}

async function uploadFiles(files: File[]) {
    if (files.length === 0) return

    isUploading.value = true

    try {
        for (const file of files) {
            const formData = new FormData()
            formData.append('file', file)

            try {
                const response = await $fetch<{ id: string; fileName: string; fileSize: number; mimeType: string }>('/api/attachments', {
                    method: 'POST',
                    body: formData
                })

                // Convert file to base64 for immediate display
                const base64Data = await new Promise<string>((resolve) => {
                    const reader = new FileReader()
                    reader.onload = () => resolve(reader.result as string)
                    reader.readAsDataURL(file)
                })

                // Add to uploaded attachments with server response and file data
                uploadedAttachments.value.push({
                    id: response.id,
                    name: response.fileName,
                    size: response.fileSize,
                    type: response.mimeType,
                    data: base64Data
                })
            } catch (error) {
                console.error('Error uploading file:', error)
                toast.error(t('chat.upload_error'))
            }
        }
    } finally {
        isUploading.value = false
        // Clear the file input
        if (fileInputRef.value) {
            fileInputRef.value.value = ''
        }
    }
}

async function removeAttachment(idx: number) {
    const attachment = uploadedAttachments.value[idx]
    if (!attachment) return

    try {
        // Call backend to delete the attachment
        await $fetch(`/api/attachments/${attachment.id}`, {
            method: 'DELETE'
        })

        // Remove from local array
        uploadedAttachments.value.splice(idx, 1)
        toast.success(t('chat.attachment_removed'))
    } catch (error) {
        console.error('Error removing attachment:', error)
        toast.error(t('chat.attachment_remove_error'))
    }
}

function handleDrop(e: DragEvent) {
    e.preventDefault()
    if (e.dataTransfer?.files?.length) {
        uploadFiles(Array.from(e.dataTransfer.files))
    }
}

function handleDragOver(e: DragEvent) {
    e.preventDefault()
}

function getFileTypeIconFromType(type: string) {
    if (type.startsWith('image/')) {
        return 'lucide:image'
    } else if (type === 'application/pdf') {
        return 'lucide:file-text'
    }
    return 'lucide:file'
}

function formatFileSize(bytes: number) {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
</script>

<template>
    <div class="pointer-events-none absolute bottom-0 z-10 w-full px-2">
        <div class="relative mx-auto flex w-full max-w-3xl flex-col text-center">

            <!-- Scroll to bottom button positioned above input form -->
            <Transition enter-active-class="transition-all duration-200 ease-out"
                enter-from-class="opacity-0 translate-y-2" enter-to-class="opacity-100 translate-y-0"
                leave-active-class="transition-all duration-200 ease-in" leave-from-class="opacity-100 translate-y-0"
                leave-to-class="opacity-0 translate-y-2">
                <div v-show="showScrollToBottom" class="pointer-events-auto mb-3 flex justify-center"> <button
                        class="flex h-8 px-3 items-center justify-center rounded-full bg-background/95 backdrop-blur-sm border border-border shadow-lg hover:bg-secondary/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-sm font-medium text-muted-foreground gap-1.5"
                        :aria-label="$t('chat.scroll_to_bottom')" @click="scrollToBottom?.()">
                        <Icon name="lucide:arrow-down" class="h-4 w-4" />
                        <span class="hidden sm:inline">{{ $t('chat.scroll_to_bottom') }}</span>
                    </button>
                </div>
            </Transition>

            <div id="chat-input-container" class="pointer-events-none">
                <div class="pointer-events-auto">
                    <div class="rounded-t-[20px] bg-[var(--chat-input-background)] p-2 pb-0 backdrop-blur-lg">
                        <form ref="chatInputForm"
                            class="relative flex w-full flex-col items-stretch gap-2 rounded-t-xl border border-b-0 border-white/70 bg-[var(--chat-input-background)] px-3 pt-3 text-secondary-foreground outline outline-[var(--chat-input-gradient)] pb-safe-offset-3 max-sm:pb-6 sm:max-w-3xl dark:border-[hsl(0,0%,83%)]/[0.04] dark:bg-secondary/[0.045] dark:outline-chat-background/40"
                            @submit.prevent="handleFormSubmit()" @drop="handleDrop" @dragover="handleDragOver">
                            <div class="flex flex-grow flex-row items-start">
                                <textarea id="chat-input" ref="chatInput" v-model="input" name="input"
                                    :placeholder="$t('chat.input_placeholder')" class="w-full resize-none bg-transparent text-base leading-6 text-foreground outline-none 
                    placeholder:text-secondary-foreground/60 disabled:opacity-0" :aria-label="$t('chat.message_input')"
                                    aria-describedby="chat-input-description" autocomplete="off"
                                    style="height: 48px; min-height: 48px; max-height: 240px;"
                                    @keydown.enter.exact.prevent="handleFormSubmit()"
                                    @keydown.enter.shift.exact.prevent="() => { input += '\n'; computeTextareaHeight() }"
                                    @input="computeTextareaHeight" />
                                <div id="chat-input-description" class="sr-only">{{ $t('chat.input_description') }}
                                </div> <!-- Bottone paperclip - mostra solo se il modello supporta allegati -->
                                <Button v-if="supportsAttachments" variant="ghost" type="button"
                                    @click="triggerFileInput" size="sm"
                                    class="ml-2 flex items-center justify-center cursor-pointer"
                                    :disabled="isUploading">
                                    <Icon name="lucide:loader" class="animate-spin w-4 h-4" v-if="isUploading" />
                                    <Icon name="lucide:paperclip" class="w-5 h-5" />
                                </Button>
                                <!-- File input wrapped in ClientOnly to prevent hydration mismatches -->
                                <ClientOnly>
                                    <input v-if="supportsAttachments" ref="fileInputRef" type="file" class="hidden"
                                        accept="image/*,application/pdf" @change="handleFileChange" multiple>
                                </ClientOnly>
                            </div> <!-- Lista allegati caricati -->
                            <div v-if="uploadedAttachments.length" class="flex flex-wrap gap-2 mt-2">
                                <div v-for="(att, idx) in uploadedAttachments" :key="att.id"
                                    class="flex items-center gap-2 bg-secondary/30 rounded-lg px-3 py-2 text-sm border">
                                    <Icon :name="getFileTypeIconFromType(att.type)"
                                        class="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                    <div class="min-w-0 flex-1">
                                        <div class="font-medium truncate">{{ att.name }}</div>
                                        <div class="text-xs text-muted-foreground">{{ formatFileSize(att.size) }}</div>
                                    </div>
                                    <button type="button"
                                        class="text-muted-foreground hover:text-destructive transition-colors p-1"
                                        @click="removeAttachment(idx)" :aria-label="`Rimuovi ${att.name}`">
                                        <Icon name="lucide:x" class="w-3 h-3" />
                                    </button>
                                </div>
                            </div>

                            <div class="-mb-px mt-2 flex w-full flex-row justify-between">
                                <div class="flex flex-col gap-2 pr-2 sm:flex-row sm:items-center">
                                    <div class="flex items-center flex-wrap gap-1">
                                        <Popover v-model:open="isPopoverModelSelectionOpen">
                                            <PopoverTrigger as-child>
                                                <Button variant="ghost" size="sm" class="cursor-pointer">
                                                    <div class="text-left text-sm font-medium">
                                                        <ClientOnly>
                                                            {{ selectedModelDisplayName }}
                                                            <template #fallback>
                                                                {{ t('chat.loading_models') }}
                                                            </template>
                                                        </ClientOnly>
                                                    </div>
                                                    <Icon name="lucide:chevron-down" class="!size-4" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent class="p-0 transition-[height,width] ease-snappy max-sm:mx-4 sm:w-[420px] max-h-[calc(100vh-80px)] 
                                                min-h-[450px]
                                                relative" align="start" side="top">
                                                <ChatCommandModelSelection @model-selected="handleModelSelected"
                                                    @close="handleModelSelected" />
                                            </PopoverContent>
                                        </Popover>

                                        <!-- Reasoning Configuration -->
                                        <ClientOnly>
                                            <ChatCommandReasoningConfig
                                                v-if="supportsReasoningEffort && isModelSelected && reasoningConfig"
                                                v-model="reasoningConfig"
                                                :provider="selectedModelInfo?.provider as LLM_PROVIDERS"
                                                :developer="selectedModelInfo?.developer || 'Unknown'" />
                                        </ClientOnly>

                                        <!-- Web Search Toggle -->
                                        <ClientOnly>
                                            <ChatCommandWebSearchToggle v-if="isModelSelected && supportsWebSearch"
                                                v-model="webSearchEnabled"
                                                :provider="selectedModelInfo?.provider as LLM_PROVIDERS"
                                                :developer="selectedModelInfo?.developer || 'Unknown'"
                                                :supports-web-search="supportsWebSearch" />
                                        </ClientOnly>

                                        <!-- Image Generation Configuration -->
                                        <ClientOnly>
                                            <ChatCommandImageGenerationConfig
                                                v-if="isModelSelected && supportsImages && imageGenerationConfig"
                                                v-model="imageGenerationConfig"
                                                :provider="selectedModelInfo?.provider as LLM_PROVIDERS"
                                                :developer="selectedModelInfo?.developer || 'Unknown'" />
                                        </ClientOnly>
                                    </div>
                                </div>
                                <div class="-mr-0.5 -mt-0.5 flex items-end justify-center gap-2"
                                    :aria-label="$t('chat.message_actions')">
                                    <ClientOnly>
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger as-child> <span tabindex="0" :class="{
                                                    'cursor-not-allowed': (!input && uploadedAttachments.length === 0 || !isModelSelected || isUploading) && status !== 'submitted' && status !== 'streaming'
                                                }">
                                                        <Button v-if="status !== 'submitted' && status !== 'streaming'"
                                                            type="submit"
                                                            class="size-9 cursor-pointer disabled:cursor-not-allowed"
                                                            :disabled="(!input && uploadedAttachments.length === 0) || !isModelSelected || isUploading"
                                                            size="icon"
                                                            :aria-label="isUploading ? $t('chat.uploading_attachments') : !isModelSelected ? $t('chat.model_required') : (!input && uploadedAttachments.length === 0) ? $t('chat.message_requires_content') : $t('chat.send_message')">
                                                            <Icon v-if="isUploading" name="lucide:loader"
                                                                class="!size-5 animate-spin" />
                                                            <Icon v-else name="lucide:arrow-up" class="!size-5" />
                                                        </Button>
                                                        <Button v-if="status === 'submitted' || status === 'streaming'"
                                                            type="button"
                                                            class="size-9 cursor-pointer disabled:cursor-not-allowed"
                                                            size="icon"
                                                            :aria-label="$t('chat.cancel_response_generation')"
                                                            @click="stop">
                                                            <Icon name="lucide:square" class="!size-5" />
                                                        </Button>
                                                    </span>
                                                </TooltipTrigger>
                                                <TooltipContent side="top">
                                                    <span v-if="isUploading">{{ $t('chat.uploading_attachments')
                                                        }}</span>
                                                    <span v-else-if="!isModelSelected">{{ $t('chat.model_required')
                                                        }}</span>
                                                    <span v-else-if="!input && uploadedAttachments.length === 0">{{
                                                        $t('chat.message_requires_content')
                                                    }}</span>
                                                    <span v-else>{{ $t('chat.send_message') }}</span>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </ClientOnly>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>