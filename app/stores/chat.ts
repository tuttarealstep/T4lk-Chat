import { defineStore } from 'pinia'
import type { Message } from '~/types/chat'
import { groupThreadsByDate } from '~/utils/threadGrouping'

export interface Thread {
  id: string
  title: string
  to: string
  pinned: boolean | null
  generationStatus: 'pending' | 'generating' | 'completed'
  branchedFromThreadId: string | null
  messages: Message[]
  updatedAt: Date
  createdAt: Date
}

export interface ThreadGroup {
  id: string
  label: string
  items: Thread[]
}

export const useChatStore = defineStore('chat', () => {
  // ===== STATE =====
  const threads = ref<Thread[]>([])
  const currentThreadId = ref<string | null>(null)
  const searchQuery = ref<string>('')

  // Message operations
  const isEditingMessage = ref<string | null>(null)
  const editingText = ref('')

  // Loading states
  const isLoadingThreads = ref(false)
  const isLoadingCurrentThread = ref(false)
  const isDeletingThread = ref(false)

  // ===== COMPUTED =====

  // Get current thread
  const currentThread = computed(() =>
    threads.value.find(thread => thread.id === currentThreadId.value)
  )

  // Filter threads based on search
  const filteredThreads = computed(() => {
    if (!searchQuery.value.trim()) {
      return threads.value
    }

    const query = searchQuery.value.toLowerCase().trim()
    return threads.value.filter(thread =>
      thread.title.toLowerCase().includes(query)
    )
  })
  
  // Function to group threads by date (to be called with translations from components)
  const getGroupedThreads = (labels: {
    pinned: string
    today: string
    yesterday: string
    lastWeek: string
    lastMonth: string
  }): ThreadGroup[] => {
    return groupThreadsByDate(filteredThreads.value, labels)
  }

  // ===== ACTIONS =====
  // Load all threads
  const loadThreads = async (forceRefresh = false) => {
    if (isLoadingThreads.value && !forceRefresh) return

    try {
      isLoadingThreads.value = true
      const data = await $fetch<Thread[]>('/api/threads')
      threads.value = data || []

      // Check and clean orphaned branched threads
      await checkBranchedThreadOriginal()
    } catch (error) {
      console.error('Failed to load threads:', error)
      threads.value = []
    } finally {
      isLoadingThreads.value = false
    }
  }

  // Get specific thread
  const getThread = async (threadId: string) => {
    try {
      if (currentThreadId.value === threadId && currentThread.value) {
        isLoadingCurrentThread.value = true
      }
      const thread = await $fetch<Thread>(`/api/thread/${threadId}`)

      // Update thread in the list if it exists
      const existingIndex = threads.value.findIndex(t => t.id === threadId)
      if (existingIndex >= 0) {
        threads.value[existingIndex] = thread
      } else {
        threads.value.unshift(thread)
      }

      return thread
    } catch (error) {
      console.error('Failed to get thread:', error)
      throw error
    } finally {
      isLoadingCurrentThread.value = false
    }
  }

  // Update thread
  const updateThread = async (threadId: string, updates: Partial<Thread>) => {
    try {
      const updatedThread = await $fetch<Thread>(`/api/thread/${threadId}`, {
        method: 'PATCH',
        body: updates
      })

      // Update in local state
      const index = threads.value.findIndex(t => t.id === threadId)
      if (index >= 0) {
        threads.value[index] = updatedThread
      }

      return updatedThread
    } catch (error) {
      console.error('Failed to update thread:', error)
      throw error
    }
  }

  // Delete thread
  const deleteThread = async (threadId: string) => {
    try {
      isDeletingThread.value = true
      await $fetch(`/api/thread/${threadId}`, { method: 'DELETE' })

      // Remove from local state
      threads.value = threads.value.filter(t => t.id !== threadId)

      // Clear current thread if it was deleted
      if (currentThreadId.value === threadId) {
        currentThreadId.value = null
      }

      // Clean up orphaned branch references after deletion
      threads.value = threads.value.map(thread => {
        if (thread.branchedFromThreadId === threadId) {
          return { ...thread, branchedFromThreadId: null }
        }
        return thread
      })
    } catch (error) {
      console.error('Failed to delete thread:', error)
      throw error
    } finally {
      isDeletingThread.value = false
    }
  }

  // Pin/unpin thread
  const toggleThreadPin = async (threadId: string) => {
    const thread = threads.value.find(t => t.id === threadId)
    if (!thread) return

    try {
      await updateThread(threadId, { pinned: !thread.pinned })
    } catch (error) {
      console.error('Failed to toggle thread pin:', error)
      throw error
    }
  }

  // Set current thread
  const setCurrentThread = (threadId: string | null) => {
    currentThreadId.value = threadId
  }

  // Set search query
  const setSearchQuery = (query: string) => {
    searchQuery.value = query
  }

  // Message operations
  const startEditMessage = (message: Message) => {
    if (message.role !== 'user') return

    isEditingMessage.value = message.id
    editingText.value = message.content || ''
  }

  const cancelEditMessage = () => {
    isEditingMessage.value = null
    editingText.value = ''
  }

  const updateEditingText = (text: string) => {
    editingText.value = text
  }

  // Split thread from a specific message
  const splitThread = async (threadId: string, messageId: string) => {
    try {
      const newThread = await $fetch<Thread>(`/api/thread/${threadId}/split`, {
        method: 'POST',
        body: { messageId }
      })

      // Add new thread to the beginning of the list
      threads.value.unshift(newThread)

      return newThread
    } catch (error) {
      console.error('Failed to split thread:', error)
      throw error
    }
  }

  // Check if original thread exists for branched threads
  const checkBranchedThreadOriginal = async () => {
    // Get all branched threads
    const branchedThreads = threads.value.filter(t => t.branchedFromThreadId)

    for (const thread of branchedThreads) {
      const originalExists = threads.value.some(t => t.id === thread.branchedFromThreadId)

      if (!originalExists && thread.branchedFromThreadId) {
        // Original thread was deleted, clear the branch reference
        try {
          await updateThread(thread.id, { branchedFromThreadId: null })
        } catch (error) {
          console.error('Failed to clear branch reference:', error)
        }
      }
    }
  }

  // Initialize store
  const initialize = async () => {
    if (import.meta.client) {
      await loadThreads()
    }
  }

  // Clear all chat data (used when transitioning to anonymous)
  const clearChatData = () => {
    threads.value = []
    currentThreadId.value = null
    searchQuery.value = ''
    isEditingMessage.value = null
    editingText.value = ''
    isLoadingThreads.value = false
    isLoadingCurrentThread.value = false
    isDeletingThread.value = false
  }

  return {
    // State
    threads,
    currentThreadId,
    currentThread,
    searchQuery,
    isEditingMessage,
    editingText,
    isLoadingThreads,
    isLoadingCurrentThread,
    isDeletingThread,
    // Computed
    filteredThreads,
    getGroupedThreads,    // Actions
    initialize,
    loadThreads,
    getThread,
    updateThread,
    deleteThread,
    toggleThreadPin,
    setCurrentThread,
    setSearchQuery,
    startEditMessage,
    cancelEditMessage,
    updateEditingText, splitThread,
    checkBranchedThreadOriginal,
    clearChatData
  }
})
