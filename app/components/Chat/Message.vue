<script setup lang="ts">
import type { UIMessage } from '~/types/chat';
import type { FileUIPart } from '@ai-sdk/ui-utils';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useClipboard } from '@vueuse/core';
import { toast } from 'vue-sonner';
import { useI18n } from 'vue-i18n';
import { ref, computed, inject, type Ref } from 'vue';
import { useUserStore } from '~/stores/user'
import { useChatStore } from '~/stores/chat'
import ChatDialogConfirmEdit from '~/components/Chat/Dialog/ConfirmEdit.vue';
import ChatDialogConfirmRetry from '~/components/Chat/Dialog/ConfirmRetry.vue';
import ChatPopoverRetryMessage from '~/components/Chat/Popover/RetryMessage.vue';
import type { UseChatHelpers } from '@ai-sdk/vue';
import { validateMessageLength } from '~/utils/messageValidation';

interface Props {
    message: UIMessage
    isLastMessage?: boolean
    readOnly?: boolean
}

interface Emits {
    'edit-message': [messageId: string, newText: string]
    'retry-message': [messageId: string, modelId?: string]
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const clipboard = useClipboard();
const { t } = useI18n();
const showCheck = ref<{ [key: string]: boolean }>({});
const userStore = useUserStore();
const chatStore = useChatStore();

// Dialog states
const showConfirmEdit = ref(false);
const showConfirmRetry = ref(false);
const messagesToDeleteCount = ref(0);
const pendingRetryModelId = ref<string | undefined>(undefined);

// Inject selected model for validation and helper functions
const selectedModel = inject('selectedModel') as Ref<string> | undefined
const chatState = inject('chatState') as UseChatHelpers | undefined
const getMessagesAfterCount = inject('getMessagesAfterCount') as ((messageId: string) => number) | undefined
const isStreaming = inject('isStreaming') as ComputedRef<boolean> | undefined

// Helper functions for message operations
const startEditMessage = (message: UIMessage) => {
    chatStore.startEditMessage(message)
}

const cancelEditMessage = () => {
    chatStore.cancelEditMessage()
}

// Check if this message is being edited
const isCurrentlyEditing = computed(() => chatStore.isEditingMessage === props.message.id)

// Computed properties for token metrics
const promptTokens = computed(() => props.message.usage?.promptTokens || 0)
const completionTokens = computed(() => props.message.usage?.completionTokens || 0)
const totalTokens = computed(() => promptTokens.value + completionTokens.value)

const tokensPerSecond = computed(() => {
    if (!props.message.generationStartAt || !props.message.generationEndAt || totalTokens.value === 0) {
        return 0
    }
    const responseTime = (props.message.generationEndAt - props.message.generationStartAt) / 1000
    if (responseTime <= 0) {
        return 0
    }
    const tps = totalTokens.value / responseTime
    return isFinite(tps) ? tps : 0
})

const generationTime = computed(() => {
    if (!props.message.generationStartAt || !props.message.generationEndAt) {
        return 0
    }
    const time = (props.message.generationEndAt - props.message.generationStartAt) / 1000
    return time >= 0 ? time : 0
})

// Helper computed to check individual metrics validity
const hasValidTokensPerSecond = computed(() => {
    return tokensPerSecond.value > 0 && isFinite(tokensPerSecond.value)
})

const hasValidTotalTokens = computed(() => {
    return totalTokens.value > 0 && isFinite(totalTokens.value)
})

const hasValidGenerationTime = computed(() => {
    return generationTime.value > 0 && isFinite(generationTime.value)
})

const hasAnyValidMetrics = computed(() => {
    return hasValidTokensPerSecond.value || hasValidTotalTokens.value || hasValidGenerationTime.value
})

function copyMessageContent(role: string) {
    clipboard.copy(props.message.content || '');
    toast.success(t('message_copied'));
    showCheck.value[role] = true;
    setTimeout(() => {
        showCheck.value[role] = false;
    }, 1200);
}

// Handle edit actions
const handleStartEdit = () => {
    startEditMessage(props.message)
}

const handleCancelEdit = () => {
    cancelEditMessage()
}

const handleSaveEdit = () => {
    if (!selectedModel?.value) {
        toast.error(t('chat.model_required'))
        return
    }

    const newText = chatStore.editingText.trim()
    if (!newText) {
        toast.error(t('chat.message_requires_text'))
        return
    }

    // Validate message length
    const validation = validateMessageLength(newText, selectedModel.value)
    if (!validation.valid) {
        toast.error(t('message_too_long', { current: validation.current, max: validation.max }))
        return
    }

    // If the message is not changed, just cancel edit
    if (newText === props.message.content) {
        cancelEditMessage()
        return
    }

    // Calculate messages that would be deleted using helper function
    if (getMessagesAfterCount) {
        messagesToDeleteCount.value = getMessagesAfterCount(props.message.id)

        // Always show confirmation for edit operations since they affect subsequent messages
        showConfirmEdit.value = true
        return
    }

    // No helper function available, proceed directly
    proceedWithEdit()
}

const proceedWithEdit = () => {
    emit('edit-message', props.message.id, chatStore.editingText.trim())
    cancelEditMessage()
    showConfirmEdit.value = false
}

const proceedWithRetry = () => {
    emit('retry-message', props.message.id, pendingRetryModelId.value)
    pendingRetryModelId.value = undefined
    showConfirmRetry.value = false
}

// Handle retry actions
const handleRetryMessage = (modelId?: string) => {
    // Calculate messages that would be deleted using helper function
    if (getMessagesAfterCount) {
        // For retry, we calculate messages that will be deleted:
        // - If retrying an assistant message: delete that message and all after it
        // - If retrying a user message: delete all messages after it
        if (props.message.role === 'assistant') {
            // For assistant messages, we count from this message (inclusive)
            messagesToDeleteCount.value = getMessagesAfterCount(props.message.id) + 1
        } else {
            // For user messages, we count messages after this one
            messagesToDeleteCount.value = getMessagesAfterCount(props.message.id)
        }

        if (messagesToDeleteCount.value > 0) {
            // Store the modelId for later use in proceedWithRetry
            pendingRetryModelId.value = modelId
            showConfirmRetry.value = true
            return
        }
    }

    // No messages to delete, proceed directly
    emit('retry-message', props.message.id, modelId)
}

// Handle split thread action
const handleSplitThread = async () => {
    try {
        const currentThread = chatStore.currentThread
        if (!currentThread || isStreaming?.value) {
            return
        }

        const newThread = await chatStore.splitThread(currentThread.id, props.message.id)

        // Show success message
        toast.success(t('thread_split_success'))

        // Navigate to the new thread
        await navigateTo(`/chat/${newThread.id}`)
    } catch (error) {
        console.error('Error splitting thread:', error)
        toast.error(t('thread_split_failed'))
    }
}

// Auto-resize textarea
const computeTextareaHeight = (textarea: HTMLTextAreaElement) => {
    textarea.style.height = 'auto'
    const scrollHeight = textarea.scrollHeight
    const minHeight = 48
    const maxHeight = 200
    const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight)
    textarea.style.height = `${newHeight}px`
}

// Handle textarea input
const handleTextareaInput = (event: Event) => {
    const textarea = event.target as HTMLTextAreaElement
    computeTextareaHeight(textarea)
}

// Handle enter key in edit mode
const handleEditKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        handleSaveEdit()
    } else if (event.key === 'Escape') {
        event.preventDefault()
        handleCancelEdit()
    }
}

// Computed property to extract file parts from message parts
const filePartsFromMessage = computed((): FileUIPart[] => {
    if (!props.message.parts || !Array.isArray(props.message.parts)) {
        return []
    }

    return props.message.parts.filter((part): part is FileUIPart =>
        part.type === 'file' &&
        'mimeType' in part &&
        'data' in part &&
        typeof part.mimeType === 'string' &&
        typeof part.data === 'string' &&
        part.data.length > 0
    )
})

// Separate computed properties for different file types
const imagePartsFromMessage = computed(() => {
    return filePartsFromMessage.value.filter(part =>
        part.mimeType?.startsWith('image/')
    )
})

const pdfPartsFromMessage = computed(() => {
    return filePartsFromMessage.value.filter(part =>
        part.mimeType === 'application/pdf'
    )
})

const otherFilePartsFromMessage = computed(() => {
    return filePartsFromMessage.value.filter(part =>
        !part.mimeType?.startsWith('image/') &&
        part.mimeType !== 'application/pdf'
    )
})

// Functions to handle files from FileUIPart
const openImageModalFromPart = (filePart: FileUIPart, _index: number) => {
    // Open image in new tab
    window.open(filePart.data, '_blank')
}

const downloadImageFromPart = (filePart: FileUIPart, index: number) => {
    // Extract file extension from mimeType
    const mimeType = filePart.mimeType || 'image/png'
    const extension = mimeType.split('/')[1] || 'png'

    const link = document.createElement('a')
    link.href = filePart.data
    link.download = `generated-image-${index + 1}.${extension}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success(t('image_downloaded'))
}

const downloadFileFromPart = (filePart: FileUIPart, fileName?: string) => {
    try {
        let downloadData = filePart.data

        // Handle data URLs vs base64 strings
        if (!downloadData.startsWith('data:')) {
            downloadData = `data:${filePart.mimeType || 'application/octet-stream'};base64,${downloadData}`
        }

        const link = document.createElement('a')
        link.href = downloadData
        link.download = fileName || `attachment-${Date.now()}`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        toast.success(t('file_downloaded'))
    } catch (error) {
        console.error('Download failed:', error)
        toast.error(t('download_failed'))
    }
}

const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('pdf')) return 'lucide:file-text'
    if (mimeType.includes('text')) return 'lucide:file-text'
    if (mimeType.includes('word') || mimeType.includes('document')) return 'lucide:file-text'
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'lucide:file-spreadsheet'
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'lucide:presentation'
    if (mimeType.includes('zip') || mimeType.includes('archive')) return 'lucide:file-archive'
    return 'lucide:file'
}

const viewPdfInNewTab = (filePart: FileUIPart) => {
    window.open(filePart.data, '_blank')
}

const getFileTypeLabel = (mimeType: string) => {
    if (mimeType.includes('pdf')) return 'PDF'
    if (mimeType.includes('text')) return 'Text'
    if (mimeType.includes('word') || mimeType.includes('document')) return 'Document'
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'Spreadsheet'
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'Presentation'
    if (mimeType.includes('zip') || mimeType.includes('archive')) return 'Archive'
    return 'File'
}

</script>

<template>
    <div :id="`message-${props.message.id}`" class="flex" :class="{
        'justify-start': props.message.role === 'user',
        'justify-end': props.message.role === 'assistant'
    }" :aria-label="`Message from ${props.message.role}`" :role="props.message.role" :data-role="props.message.role">
        <div class="group/message relative w-full scroll-mt-4 sm:scroll-mt-6">
            <article class="prose max-w-none dark:prose-invert" :data-role="props.message.role">
                <div class="relative flex items-start max-w-[95%] lg:max-w-[85%] gap-3" :class="{
                    'ltr:justify-end ms-auto': props.message.role === 'user',
                    'ltr:justify-start': props.message.role === 'assistant'
                }">
                    <div class="relative text-pretty min-w-0 px-4 py-3 rounded-lg min-h-12" :class="{
                        'bg-secondary text-secondary-foreground': props.message.role === 'assistant',
                        'bg-primary text-primary-foreground': props.message.role === 'user'
                    }">
                        <!-- Editing mode for user messages -->
                        <div v-if="isCurrentlyEditing && props.message.role === 'user'" class="space-y-2">
                            <Textarea v-model="chatStore.editingText"
                                class="min-h-[48px] max-h-[200px] resize-none bg-transparent border-none shadow-none focus-visible:ring-0 text-inherit p-2"
                                :placeholder="t('chat.input_placeholder')"
                                :maxlength="selectedModel ? getMaxCharactersForModel(selectedModel) : undefined"
                                autofocus @input="handleTextareaInput" @keydown="handleEditKeydown" />

                            <!-- Action buttons -->
                            <div class="flex justify-end gap-2">
                                <Button size="sm" variant="ghost" class="cursor-pointer" @click="handleCancelEdit">
                                    <Icon name="lucide:x" class="size-4" />
                                    {{ t('cancel_edit') }}
                                </Button>
                                <Button variant="secondary" class="cursor-pointer" size="sm"
                                    :disabled="!chatStore.editingText.trim()" @click="handleSaveEdit">
                                    <Icon name="lucide:save" class="size-4" />
                                    {{ t('save_edit') }}
                                </Button>
                            </div>
                        </div>

                        <!-- Error message display -->
                        <div v-else-if="props.message.isError">
                            <div class="flex items-start gap-3">
                                <Icon name="lucide:alert-triangle"
                                    class="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                                <div class="flex-1">
                                    <h4 class="font-medium text-destructive mb-2">
                                        {{ props.message.errorType === 'pending' ? $t('chat.request_incomplete') :
                                            $t('chat.request_interrupted') }}
                                    </h4>
                                    <p class="text-sm text-muted-foreground mb-3">
                                        {{ props.message.errorType === 'pending'
                                            ? $t('chat.request_incomplete_desc')
                                            : $t('chat.request_interrupted_desc') }}
                                    </p>
                                    <Button size="sm" variant="outline" class="cursor-pointer" :disabled="isStreaming"
                                        @click="() => {
                                            const lastUserMessage = [...chatState?.messages.value || []].reverse().find(msg => msg.role === 'user' && msg.id !== props.message.id)
                                            if (lastUserMessage) {
                                                emit('retry-message', lastUserMessage.id)
                                            }
                                        }">
                                        <Icon name="lucide:refresh-cw" class="h-4 w-4 mr-2" />
                                        {{ $t('chat.retry_from_here') }}
                                    </Button>
                                </div>
                            </div>
                        </div>
                        <!-- Normal display mode -->
                        <div v-else>
                            <slot name="content" :message="props.message" :is-last-message="props.isLastMessage" />
                            <template v-if="!$slots.content">
                                {{ props.message.content }}
                            </template>
                            <!-- Display file parts from message parts -->
                            <div v-if="filePartsFromMessage.length > 0" class="mt-4 space-y-4">
                                <!-- Images -->
                                <div v-if="imagePartsFromMessage.length > 0" class="space-y-2">
                                    <div class="grid gap-2" :class="{
                                        'grid-cols-1': imagePartsFromMessage.length === 1,
                                        'grid-cols-2': imagePartsFromMessage.length === 2,
                                        'grid-cols-2 lg:grid-cols-3': imagePartsFromMessage.length >= 3
                                    }">
                                        <div v-for="(filePart, index) in imagePartsFromMessage" :key="`image-${index}`"
                                            class="relative group overflow-hidden rounded-lg border bg-muted">
                                            <img :src="filePart.data" :alt="`Image ${index + 1}`"
                                                class="w-full h-auto max-h-96 object-contain cursor-pointer transition-transform hover:scale-105"
                                                @click="openImageModalFromPart(filePart, index)">
                                            <!-- Download button overlay -->
                                            <div
                                                class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger as-child>
                                                            <Button variant="secondary" size="icon"
                                                                class="size-8 bg-background/80 backdrop-blur-sm cursor-pointer"
                                                                @click.stop="downloadImageFromPart(filePart, index)">
                                                                <Icon name="lucide:download" class="size-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="bottom">
                                                            {{ $t('download_image') }}
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- PDFs -->
                                <div v-if="pdfPartsFromMessage.length > 0" class="space-y-2">
                                    <div class="grid gap-2">
                                        <div v-for="(filePart, index) in pdfPartsFromMessage" :key="`pdf-${index}`"
                                            class="flex items-center gap-3 p-3 rounded-lg border bg-muted hover:bg-muted/80 transition-colors">
                                            <div class="flex-shrink-0">
                                                <Icon :name="getFileIcon(filePart.mimeType || '')"
                                                    class="size-6 text-muted-foreground" />
                                            </div>
                                            <div class="flex-1 min-w-0">
                                                <div class="font-medium text-sm">PDF Document</div>
                                                <div class="text-xs text-muted-foreground">{{
                                                    getFileTypeLabel(filePart.mimeType || '') }}</div>
                                            </div>
                                            <div class="flex gap-2">
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger as-child>
                                                            <Button variant="ghost" size="icon"
                                                                class="size-8 cursor-pointer"
                                                                @click="viewPdfInNewTab(filePart)">
                                                                <Icon name="lucide:eye" class="size-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="bottom">
                                                            {{ $t('view_pdf') }}
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger as-child>
                                                            <Button variant="ghost" size="icon"
                                                                class="size-8 cursor-pointer"
                                                                @click="downloadFileFromPart(filePart, `document-${index + 1}.pdf`)">
                                                                <Icon name="lucide:download" class="size-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="bottom">
                                                            {{ $t('download_file') }}
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Other files -->
                                <div v-if="otherFilePartsFromMessage.length > 0" class="space-y-2">
                                    <div class="grid gap-2">
                                        <div v-for="(filePart, index) in otherFilePartsFromMessage"
                                            :key="`file-${index}`"
                                            class="flex items-center gap-3 p-3 rounded-lg border bg-muted hover:bg-muted/80 transition-colors">
                                            <div class="flex-shrink-0">
                                                <Icon :name="getFileIcon(filePart.mimeType || '')"
                                                    class="size-6 text-muted-foreground" />
                                            </div>
                                            <div class="flex-1 min-w-0">
                                                <div class="font-medium text-sm">{{ getFileTypeLabel(filePart.mimeType
                                                    || '') }}</div>
                                                <div class="text-xs text-muted-foreground">{{ filePart.mimeType ||
                                                    'Unknown type' }}</div>
                                            </div>
                                            <div class="flex gap-2">
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger as-child>
                                                            <Button variant="ghost" size="icon"
                                                                class="size-8 cursor-pointer"
                                                                @click="downloadFileFromPart(filePart, `file-${index + 1}`)">
                                                                <Icon name="lucide:download" class="size-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="bottom">
                                                            {{ $t('download_file') }}
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </article>
            <!-- Message Actions Toolbar -->
            <ClientOnly>
                <div v-if="props.message.parts.length > 0 && !props.message.isError"
                    class="absolute left-0 -ml-0.5 mt-2 flex w-full flex-row gap-1 opacity-0 transition-opacity group-focus-within/message:opacity-100 group-hover/message:opacity-100 group-focus/message:opacity-100"
                    :class="{
                        'justify-start': props.message.role === 'assistant',
                        'justify-end': props.message.role === 'user'
                    }">
                    <div class="flex w-full flex-row gap-1 sm:w-auto" :class="{
                        'justify-start': props.message.role === 'assistant',
                        'justify-between': props.message.role === 'user'
                    }">
                        <!-- Action Buttons -->
                        <div class="flex items-center gap-1">
                            <!-- Copy Button -->
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger as-child>
                                        <Button variant="ghost" size="icon" type="button"
                                            class="size-8 cursor-pointer flex items-center justify-center relative"
                                            @click="copyMessageContent(props.message.role + '-' + props.message.id)">
                                            <div class="relative size-4">
                                                <Icon name="lucide:copy"
                                                    :class="['h-4 w-4 absolute inset-0 transition-all duration-200 ease-snappy', showCheck[props.message.role + '-' + props.message.id] ? 'scale-0 opacity-0' : 'scale-100 opacity-100']" />
                                                <Icon name="lucide:check"
                                                    :class="['absolute inset-0 transition-all duration-200 ease-snappy', showCheck[props.message.role + '-' + props.message.id] ? 'scale-100 opacity-100' : 'scale-0 opacity-0']" />
                                            </div>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom">
                                        {{ $t('copy') }}
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                            <!-- Split Button (only for assistant) -->
                            <TooltipProvider v-if="props.message.role === 'assistant' && !props.readOnly">
                                <Tooltip>
                                    <TooltipTrigger as-child>
                                        <Button variant="ghost" type="button" size="icon"
                                            class="size-8 cursor-pointer relative" :disabled="isStreaming"
                                            @click="handleSplitThread">
                                            <div class="relative size-4">
                                                <Icon name="lucide:split"
                                                    class="absolute inset-0 transition-all duration-200 ease-snappy scale-100 opacity-100" />
                                                <Icon name="lucide:check"
                                                    class="absolute inset-0 transition-all duration-200 ease-snappy scale-0 opacity-0" />
                                            </div>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom">
                                        {{ $t('split') }}
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                            <!-- Edit Button (only for user) -->
                            <TooltipProvider v-if="props.message.role === 'user' && !props.readOnly">
                                <Tooltip>
                                    <TooltipTrigger as-child>
                                        <Button variant="ghost" type="button" size="icon"
                                            class="size-8 cursor-pointer relative"
                                            :disabled="isCurrentlyEditing || isStreaming" @click="handleStartEdit">
                                            <div class="relative size-4">
                                                <Icon name="lucide:square-pen"
                                                    class="absolute inset-0 transition-all duration-200 ease-snappy scale-100 opacity-100" />
                                            </div>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom">
                                        {{ $t('edit') }}
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>

                            <!-- Retry Button -->
                            <ClientOnly v-if="!props.readOnly">
                                <ChatPopoverRetryMessage :current-model="props.message.model"
                                    :message-role="(props.message.role as 'user' | 'assistant')" :disabled="isStreaming"
                                    @retry="handleRetryMessage" />
                                <template #fallback>
                                    <Button variant="ghost" size="icon" class="size-8 cursor-pointer relative">
                                        <Icon name="lucide:loader-2" class="size-4 animate-spin" />
                                    </Button>
                                </template>
                            </ClientOnly>
                        </div> <!-- Model Info (only for assistant) -->
                        <ClientOnly>
                            <div v-if="props.message.role === 'assistant'"
                                class="flex gap-2 text-xs text-muted-foreground">
                                <div class="flex items-center gap-1">
                                    <span>{{ props.message.model }}</span>
                                </div>
                            </div> <!-- Desktop Stats (only for assistant) -->
                            <div v-if="props.message.role === 'assistant' && userStore.preferences.statsForNerds && hasAnyValidMetrics"
                                class="sm:flex gap-2 text-xs text-muted-foreground">
                                <div v-if="hasValidTokensPerSecond" class="flex items-center gap-1">
                                    <Icon name="lucide:zap" class="size-3" />
                                    <span>{{ tokensPerSecond.toFixed(2) }} tok/sec</span>
                                </div>
                                <div v-if="hasValidTotalTokens" class="flex items-center gap-1">
                                    <Icon name="lucide:cpu" class="size-3" />
                                    <span>{{ totalTokens }} tokens</span>
                                </div>
                                <div v-if="hasValidGenerationTime" class="flex items-center gap-1">
                                    <Icon name="lucide:clock" class="size-3" />
                                    <span>{{ generationTime.toFixed(1) }} sec</span>
                                </div>
                            </div> <!-- Mobile Stats Popover (only for assistant) -->
                            <div v-if="props.message.role === 'assistant' && userStore.preferences.statsForNerds && hasAnyValidMetrics"
                                class="sm:hidden ml-auto">
                                <Popover>
                                    <PopoverTrigger as-child>
                                        <Button variant="ghost" size="icon" class="size-8 cursor-pointer" type="button">
                                            <Icon name="lucide:info" class="!size-4" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent class="w-48 p-3">
                                        <div class="flex flex-col gap-2">
                                            <div v-if="hasValidTokensPerSecond" class="flex items-center gap-2">
                                                <Icon name="lucide:zap" class="size-4" />
                                                <span class="text-sm">{{ tokensPerSecond.toFixed(2) }}
                                                    tok/sec</span>
                                            </div>
                                            <div v-if="hasValidTotalTokens" class="flex items-center gap-2">
                                                <Icon name="lucide:cpu" class="size-4" />
                                                <span class="text-sm">{{ totalTokens }} tokens</span>
                                            </div>
                                            <div v-if="hasValidGenerationTime" class="flex items-center gap-2">
                                                <Icon name="lucide:clock" class="size-4" />
                                                <span class="text-sm">{{ generationTime.toFixed(1) }} sec</span>
                                            </div>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </ClientOnly>
                    </div>
                </div>
            </ClientOnly>
        </div>
    </div>
    <!-- Confirm Edit Dialog -->
    <ChatDialogConfirmEdit v-model:open="showConfirmEdit" :message-count="messagesToDeleteCount"
        @confirm="proceedWithEdit" />

    <!-- Confirm Retry Dialog -->
    <ChatDialogConfirmRetry v-model:open="showConfirmRetry" :message-count="messagesToDeleteCount"
        @confirm="proceedWithRetry" />
</template>