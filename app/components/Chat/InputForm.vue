<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useFileHandling } from '~/composables/chat/useFileHandling'
import { validateMessageLength } from '~/utils/messageValidation'
import { toast } from 'vue-sonner'
import type { UseChatHelpers } from '@ai-sdk/vue'
import type { LLM_PROVIDERS } from '#shared/ai/LLM'

interface Props {
  threadId?: string
}

const props = defineProps<Props>()
const { t } = useI18n()

// Inject dependencies from parent
const chatState = inject('chatState') as UseChatHelpers
const selectedModel = inject('selectedModel') as Ref<string>
const isModelSelected = inject('isModelSelected') as ComputedRef<boolean>
const supportsAttachments = inject('supportsAttachments') as ComputedRef<boolean>
const supportsReasoningEffort = inject('supportsReasoningEffort') as ComputedRef<boolean>
const supportsWebSearch = inject('supportsWebSearch') as ComputedRef<boolean>
const supportsImages = inject('supportsImages') as ComputedRef<boolean>
const selectedModelInfo = inject('selectedModelInfo') as ComputedRef<any>
const selectedModelDisplayName = inject('selectedModelDisplayName') as ComputedRef<string>
const submitWithAttachments = inject('submitWithAttachments') as Function
const scrollToBottom = inject('scrollToBottom') as Function
const showScrollToBottom = inject('showScrollToBottom') as ComputedRef<boolean>

// Configuration injection
const reasoningConfig = inject('reasoningConfig') as Ref<Record<string, any>>
const webSearchEnabled = inject('webSearchEnabled') as Ref<boolean>
const imageGenerationConfig = inject('imageGenerationConfig') as Ref<Record<string, any>>

if (!chatState) {
  throw new Error('ChatInputForm must be used within a Chat component')
}

const { input, status, handleSubmit } = chatState

// Template refs
const chatInput = useTemplateRef('chatInput')

// File handling
const fileHandler = useFileHandling({
  supportedTypes: ['image/*', 'application/pdf'],
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5
})

const {
  isUploading,
  uploadedFiles,
  fileInputRef,
  hasFiles,
  fileIds,
  acceptString,
  uploadFiles,
  removeFile,
  clearFiles,
  triggerFileInput,
  handleFileInputChange,
  handleDrop,
  handleDragOver,
  getFileTypeIcon,
  formatFileSize
} = fileHandler

// Draft management
const draftKey = computed(() => props.threadId ? `chat-draft-${props.threadId}` : 'chat-draft-new')

const saveDraft = (content: string) => {
  if (import.meta.client) {
    if (content.trim()) {
      localStorage.setItem(draftKey.value, content)
    } else {
      localStorage.removeItem(draftKey.value)
    }
  }
}

const loadDraft = () => {
  if (import.meta.client) {
    const saved = localStorage.getItem(draftKey.value)
    if (saved && !input.value) {
      input.value = saved
      nextTick(() => computeTextareaHeight())
    }
  }
}

const clearDraft = () => {
  if (import.meta.client) {
    localStorage.removeItem(draftKey.value)
  }
}

// Textarea height management
const computeTextareaHeight = () => {
  const textarea = chatInput.value as HTMLTextAreaElement
  if (!textarea) return

  textarea.style.height = 'auto'
  
  const scrollHeight = textarea.scrollHeight
  const minHeight = 48
  const maxHeight = 240
  
  const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight)
  textarea.style.height = `${newHeight}px`
  
  if (scrollHeight > maxHeight) {
    textarea.style.overflowY = 'auto'
  } else {
    textarea.style.overflowY = 'hidden'
  }

  if (document.activeElement === textarea) {
    textarea.scrollTop = textarea.scrollHeight
  }
}

// Model selection state
const isPopoverModelSelectionOpen = ref(false)

const handleModelSelected = () => {
  isPopoverModelSelectionOpen.value = false
}

// Form submission
const handleFormSubmit = async () => {
  if (!isModelSelected.value) {
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

  if (status.value === 'streaming') {
    toast.error(t('chat.cancel_streaming_first'))
    return
  }

  // Check if we have either text or attachments
  const hasText = input.value.trim()
  const hasAttachments = uploadedFiles.value.length > 0

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

  // Get attachment data
  const attachmentIds = fileIds.value
  const attachmentData = uploadedFiles.value.map(file => ({
    id: file.id,
    name: file.name,
    size: file.size,
    type: file.type,
    data: file.data
  }))

  // Clear uploaded attachments from UI
  clearFiles()

  // Store attachment data for submission
  if (attachmentIds.length > 0) {
    submitWithAttachments(attachmentIds, attachmentData)
  }

  // Handle placeholder for attachment-only messages
  const originalInput = input.value
  const needsPlaceholder = !hasText && hasAttachments

  if (needsPlaceholder) {
    input.value = ' ' // Put a space to trigger the submit
  }

  // Submit the message
  await handleSubmit()

  // Restore original input if we used a placeholder
  if (needsPlaceholder) {
    input.value = originalInput
  }
}

// Watch input changes to save draft
watch(input, (newValue) => {
  saveDraft(newValue)
}, { immediate: false })

// Clear attachments if model doesn't support them
watch(supportsAttachments, (newSupports, oldSupports) => {
  if (oldSupports && !newSupports && hasFiles.value) {
    clearFiles()
    toast.info(t('chat.attachments_cleared_model_unsupported'))
  }
})

// Component lifecycle
onMounted(() => {
  if (chatInput.value) {
    computeTextareaHeight()
  }
  loadDraft()
})
</script>

<template>
  <div class="pointer-events-none absolute bottom-0 z-10 w-full px-2">
    <div class="relative mx-auto flex w-full max-w-3xl flex-col text-center">
      
      <!-- Scroll to bottom button -->
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        enter-from-class="opacity-0 translate-y-2"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition-all duration-200 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 translate-y-2"
      >
        <div v-show="showScrollToBottom" class="pointer-events-auto mb-3 flex justify-center">
          <button
            class="flex h-8 px-3 items-center justify-center rounded-full bg-background/95 backdrop-blur-sm border border-border shadow-lg hover:bg-secondary/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-sm font-medium text-muted-foreground gap-1.5"
            :aria-label="$t('chat.scroll_to_bottom')"
            @click="scrollToBottom?.()"
          >
            <Icon name="lucide:arrow-down" class="h-4 w-4" />
            <span class="hidden sm:inline">{{ $t('chat.scroll_to_bottom') }}</span>
          </button>
        </div>
      </Transition>

      <div id="chat-input-container" class="pointer-events-none">
        <div class="pointer-events-auto">
          <div class="rounded-t-[20px] bg-[var(--chat-input-background)] p-2 pb-0 backdrop-blur-lg">
            <form
              class="relative flex w-full flex-col items-stretch gap-2 rounded-t-xl border border-b-0 border-white/70 bg-[var(--chat-input-background)] px-3 pt-3 text-secondary-foreground outline outline-[var(--chat-input-gradient)] pb-safe-offset-3 max-sm:pb-6 sm:max-w-3xl dark:border-[hsl(0,0%,83%)]/[0.04] dark:bg-secondary/[0.045] dark:outline-chat-background/40"
              @submit.prevent="handleFormSubmit"
              @drop="handleDrop"
              @dragover="handleDragOver"
            >
              <div class="flex flex-grow flex-row items-start">
                <textarea
                  id="chat-input"
                  ref="chatInput"
                  v-model="input"
                  name="input"
                  :placeholder="$t('chat.input_placeholder')"
                  class="w-full resize-none bg-transparent text-base leading-6 text-foreground outline-none placeholder:text-secondary-foreground/60 disabled:opacity-0"
                  :aria-label="$t('chat.message_input')"
                  aria-describedby="chat-input-description"
                  autocomplete="off"
                  style="height: 48px; min-height: 48px; max-height: 240px;"
                  @keydown.enter.exact.prevent="handleFormSubmit"
                  @keydown.enter.shift.exact.prevent="() => { input += '\n'; computeTextareaHeight() }"
                  @input="computeTextareaHeight"
                />
                <div id="chat-input-description" class="sr-only">
                  {{ $t('chat.input_description') }}
                </div>

                <!-- Attachment button -->
                <Button
                  v-if="supportsAttachments"
                  variant="ghost"
                  type="button"
                  size="sm"
                  class="ml-2 flex items-center justify-center cursor-pointer"
                  :disabled="isUploading"
                  @click="triggerFileInput"
                >
                  <Icon v-if="isUploading" name="lucide:loader" class="animate-spin w-4 h-4" />
                  <Icon v-else name="lucide:paperclip" class="w-5 h-5" />
                </Button>

                <!-- Hidden file input -->
                <ClientOnly>
                  <input
                    v-if="supportsAttachments"
                    ref="fileInputRef"
                    type="file"
                    class="hidden"
                    :accept="acceptString"
                    multiple
                    @change="handleFileInputChange"
                  />
                </ClientOnly>
              </div>

              <!-- Uploaded attachments list -->
              <div v-if="hasFiles" class="flex flex-wrap gap-2 mt-2">
                <div
                  v-for="(file, idx) in uploadedFiles"
                  :key="file.id"
                  class="flex items-center gap-2 bg-secondary/30 rounded-lg px-3 py-2 text-sm border"
                >
                  <Icon
                    :name="getFileTypeIcon(file.type)"
                    class="w-4 h-4 text-muted-foreground flex-shrink-0"
                  />
                  <div class="min-w-0 flex-1">
                    <div class="font-medium truncate">{{ file.name }}</div>
                    <div class="text-xs text-muted-foreground">{{ formatFileSize(file.size) }}</div>
                  </div>
                  <button
                    type="button"
                    class="text-muted-foreground hover:text-destructive transition-colors p-1"
                    :aria-label="`Remove ${file.name}`"
                    @click="removeFile(idx)"
                  >
                    <Icon name="lucide:x" class="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div class="-mb-px mt-2 flex w-full flex-row justify-between">
                <div class="flex flex-col gap-2 pr-2 sm:flex-row sm:items-center">
                  <div class="flex items-center flex-wrap gap-1">
                    <!-- Model selection -->
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
                      <PopoverContent
                        class="p-0 transition-[height,width] ease-snappy max-sm:mx-4 sm:w-[420px] max-h-[calc(100vh-80px)] min-h-[450px] relative"
                        align="start"
                        side="top"
                      >
                        <ChatCommandModelSelection
                          @model-selected="handleModelSelected"
                          @close="handleModelSelected"
                        />
                      </PopoverContent>
                    </Popover>

                    <!-- Reasoning Configuration -->
                    <ClientOnly>
                      <ChatCommandReasoningConfig
                        v-if="supportsReasoningEffort && isModelSelected && reasoningConfig"
                        v-model="reasoningConfig"
                        :provider="selectedModelInfo?.provider as LLM_PROVIDERS"
                        :developer="selectedModelInfo?.developer || 'Unknown'"
                      />
                    </ClientOnly>

                    <!-- Web Search Toggle -->
                    <ClientOnly>
                      <ChatCommandWebSearchToggle
                        v-if="isModelSelected && supportsWebSearch"
                        v-model="webSearchEnabled"
                        :provider="selectedModelInfo?.provider as LLM_PROVIDERS"
                        :developer="selectedModelInfo?.developer || 'Unknown'"
                        :supports-web-search="supportsWebSearch"
                      />
                    </ClientOnly>

                    <!-- Image Generation Configuration -->
                    <ClientOnly>
                      <ChatCommandImageGenerationConfig
                        v-if="isModelSelected && supportsImages && imageGenerationConfig"
                        v-model="imageGenerationConfig"
                        :provider="selectedModelInfo?.provider as LLM_PROVIDERS"
                        :developer="selectedModelInfo?.developer || 'Unknown'"
                      />
                    </ClientOnly>
                  </div>
                </div>

                <div class="-mr-0.5 -mt-0.5 flex items-end justify-center gap-2">
                  <ClientOnly>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger as-child>
                          <span
                            tabindex="0"
                            :class="{
                              'cursor-not-allowed': (!input && !hasFiles || !isModelSelected || isUploading) && status !== 'submitted' && status !== 'streaming'
                            }"
                          >
                            <Button
                              v-if="status !== 'submitted' && status !== 'streaming'"
                              type="submit"
                              class="size-9 cursor-pointer disabled:cursor-not-allowed"
                              :disabled="(!input && !hasFiles) || !isModelSelected || isUploading"
                              size="icon"
                              :aria-label="
                                isUploading
                                  ? $t('chat.uploading_attachments')
                                  : !isModelSelected
                                    ? $t('chat.model_required')
                                    : (!input && !hasFiles)
                                      ? $t('chat.message_requires_content')
                                      : $t('chat.send_message')
                              "
                            >
                              <Icon
                                v-if="isUploading"
                                name="lucide:loader"
                                class="!size-5 animate-spin"
                              />
                              <Icon v-else name="lucide:arrow-up" class="!size-5" />
                            </Button>
                            <Button
                              v-if="status === 'submitted' || status === 'streaming'"
                              type="button"
                              class="size-9 cursor-pointer"
                              size="icon"
                              :aria-label="$t('chat.cancel_response_generation')"
                              @click="chatState.stop"
                            >
                              <Icon name="lucide:square" class="!size-5" />
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <span v-if="isUploading">{{ $t('chat.uploading_attachments') }}</span>
                          <span v-else-if="!isModelSelected">{{ $t('chat.model_required') }}</span>
                          <span v-else-if="!input && !hasFiles">{{ $t('chat.message_requires_content') }}</span>
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