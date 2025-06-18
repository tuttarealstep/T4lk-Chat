import { toast } from 'vue-sonner'
import { useI18n } from 'vue-i18n'
import type { Message } from '~/types/chat'
import type { UseChatHelpers } from '@ai-sdk/vue'

export interface MessageOperationsOptions {
  chat: UseChatHelpers
  selectedModel: Ref<string>
  onAttachmentsUpdate?: (attachmentIds: string[], attachmentData?: any[]) => void
}

export function useMessageOperations(options: MessageOperationsOptions) {
  const { chat, selectedModel, onAttachmentsUpdate } = options
  const { t } = useI18n()

  const isStreaming = computed(() => 
    chat.status.value === 'streaming' || chat.status.value === 'submitted'
  )

  const findMessageIndex = (messages: Message[], messageId: string): number => {
    return messages.findIndex(msg => msg.id === messageId)
  }

  const getMessagesAfterCount = (messageId: string): number => {
    const messageIndex = findMessageIndex(chat.messages.value as Message[], messageId)
    if (messageIndex === -1) return 0
    return chat.messages.value.length - messageIndex - 1
  }

  const handleEditMessage = async (messageId: string, newText: string) => {
    if (isStreaming.value) {
      toast.error(t('chat.cannot_edit_during_streaming'))
      return
    }

    try {
      const message = chat.messages.value.find(msg => msg.id === messageId) as Message
      if (!message || message.role !== 'user') {
        toast.error(t('message_not_found'))
        return
      }

      const messageIndex = findMessageIndex(chat.messages.value as Message[], messageId)
      if (messageIndex === -1) return

      // Keep messages up to the edit point
      const messagesToKeep = chat.messages.value.slice(0, messageIndex)
      chat.setMessages(messagesToKeep)

      // Set new text and submit
      chat.input.value = newText
      await nextTick()
      
      chat.handleSubmit()
      toast.success(t('edit_message'))
    } catch (error) {
      console.error('Error editing message:', error)
      toast.error(t('chat.chat_error_message', { message: 'Failed to edit message' }))
    }
  }

  const handleRetryMessage = async (messageId: string, newModelId?: string) => {
    if (isStreaming.value) {
      toast.error(t('chat.cannot_retry_during_streaming'))
      return
    }

    try {
      // Change model if specified
      if (newModelId && newModelId !== selectedModel.value) {
        selectedModel.value = newModelId
        await nextTick()
      }

      const message = chat.messages.value.find(msg => msg.id === messageId) as Message
      if (!message) {
        toast.error(t('message_not_found'))
        return
      }

      let userMessageContent = ''
      let targetMessageIndex = -1
      let messageAttachmentIds: string[] = []

      if (message.role === 'assistant') {
        // Find the previous user message
        const messageIndex = findMessageIndex(chat.messages.value as Message[], messageId)
        const userMessages = chat.messages.value.slice(0, messageIndex).filter(msg => msg.role === 'user')
        const lastUserMessage = userMessages[userMessages.length - 1]

        if (!lastUserMessage) {
          toast.error(t('chat.no_user_message_found'))
          return
        }

        userMessageContent = lastUserMessage.content || ''
        targetMessageIndex = findMessageIndex(chat.messages.value as Message[], lastUserMessage.id)

        // Get attachment IDs if message has file parts
        if (lastUserMessage.parts?.some(part => part.type === 'file')) {
          try {
            const response = await $fetch<{ attachmentIds: string[] }>(`/api/message/${lastUserMessage.id}/attachments`)
            messageAttachmentIds = response.attachmentIds || []
          } catch (error) {
            console.error('Error fetching message attachments:', error)
          }
        }
      } else {
        // For user messages, use content directly
        userMessageContent = message.content || ''
        targetMessageIndex = findMessageIndex(chat.messages.value as Message[], messageId)

        if (message.parts?.some(part => part.type === 'file')) {
          try {
            const response = await $fetch<{ attachmentIds: string[] }>(`/api/message/${message.id}/attachments`)
            messageAttachmentIds = response.attachmentIds || []
          } catch (error) {
            console.error('Error fetching message attachments:', error)
          }
        }
      }

      if (!userMessageContent || targetMessageIndex === -1) {
        toast.error(t('chat.no_user_message_found'))
        return
      }

      // Keep messages up to retry point
      const messagesToKeep = chat.messages.value.slice(0, targetMessageIndex)
      chat.setMessages(messagesToKeep)

      // Set content and attachments
      chat.input.value = userMessageContent
      
      if (messageAttachmentIds.length > 0 && onAttachmentsUpdate) {
        // Load attachment details for UI
        try {
          const response = await $fetch<{ 
            attachments: { id: string; fileName: string; fileSize: number; mimeType: string }[] 
          }>('/api/attachments/details', {
            method: 'POST',
            body: { attachmentIds: messageAttachmentIds }
          })

          const attachmentData = response.attachments.map(att => ({
            id: att.id,
            name: att.fileName,
            size: att.fileSize,
            type: att.mimeType
          }))

          onAttachmentsUpdate(messageAttachmentIds, attachmentData)
        } catch (error) {
          console.error('Error loading attachment details:', error)
          onAttachmentsUpdate(messageAttachmentIds)
        }
      }

      await nextTick()
      chat.handleSubmit()
      toast.success(t('retry_message'))
    } catch (error) {
      console.error('Error retrying message:', error)
      toast.error(t('chat.chat_error_message', { message: 'Failed to retry message' }))
    }
  }

  return {
    isStreaming,
    getMessagesAfterCount,
    handleEditMessage,
    handleRetryMessage,
  }
}