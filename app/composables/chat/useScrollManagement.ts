export interface ScrollManagementOptions {
  threshold?: number
  autoScrollDelay?: number
  smoothScrollDuration?: number
  streamingScrollThrottle?: number
}

export function useScrollManagement(options: ScrollManagementOptions = {}) {
  const {
    threshold = 50,
    autoScrollDelay = 200,
    smoothScrollDuration = 100,
    streamingScrollThrottle = 16
  } = options

  const scrollContainer = ref<HTMLElement>()
  const isUserAtBottom = ref(true)
  const isAutoScrolling = ref(false)
  const autoScrollPaused = ref(false)
  const scrollDimensionsKey = ref(0)
  const scrollTimeout = ref<NodeJS.Timeout | null>(null)
  const streamingScrollTimeout = ref<NodeJS.Timeout | null>(null)

  // Check if user is at the bottom of scroll container
  const checkIfAtBottom = (): boolean => {
    if (!scrollContainer.value) return false

    const { scrollTop, scrollHeight, clientHeight } = scrollContainer.value
    return scrollHeight - scrollTop - clientHeight <= threshold
  }

  // Check if container has scrollable content  
  const hasScrollableContent = computed(() => {
    void scrollDimensionsKey.value // Force reactivity
    
    if (!scrollContainer.value) return false
    
    const { scrollHeight, clientHeight } = scrollContainer.value
    return scrollHeight > clientHeight
  })

  // Determine if scroll to bottom button should be shown
  const shouldShowScrollButton = computed(() => {
    return hasScrollableContent.value && !isUserAtBottom.value
  })

  // Force update of scroll dimensions for reactivity
  const updateScrollDimensions = (): void => {
    scrollDimensionsKey.value++
  }

  // Scroll to bottom function with streaming optimization
  const scrollToBottom = (smooth = true, isStreamingContent = false): void => {
    if (!scrollContainer.value) return

    isAutoScrolling.value = true
    
    if (isStreamingContent) {
      // For streaming content, use direct scrollTop for immediate response
      scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight
      requestAnimationFrame(() => {
        isAutoScrolling.value = false
      })
    } else {
      // For non-streaming content, use smooth behavior
      scrollContainer.value.scrollTo({
        top: scrollContainer.value.scrollHeight,
        behavior: smooth ? 'smooth' : 'instant'
      })
      
      setTimeout(() => {
        isAutoScrolling.value = false
      }, smoothScrollDuration)
    }
  }

  // Throttled scroll for streaming content using requestAnimationFrame
  let animationFrameId: number | null = null
  const scrollToBottomThrottled = (): void => {
    if (animationFrameId !== null) return

    animationFrameId = requestAnimationFrame(() => {
      if (isUserAtBottom.value && !autoScrollPaused.value && scrollContainer.value) {
        scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight
      }
      animationFrameId = null
    })
  }

  // Handle scroll events
  const handleScroll = (): void => {
    if (isAutoScrolling.value) return

    const atBottom = checkIfAtBottom()
    isUserAtBottom.value = atBottom

    // Clear existing timeout
    if (scrollTimeout.value) {
      clearTimeout(scrollTimeout.value)
      scrollTimeout.value = null
    }

    // Re-enable auto-scroll if user scrolled back to bottom
    if (atBottom && autoScrollPaused.value) {
      autoScrollPaused.value = false
    }

    // Update scroll dimensions for reactivity
    updateScrollDimensions()
  }

  // Handle scroll during streaming
  const handleScrollDuringStreaming = (isStreaming: boolean): void => {
    if (!isStreaming) {
      autoScrollPaused.value = false
      return
    }

    const atBottom = checkIfAtBottom()
    
    if (!atBottom) {
      // If user scrolled away during streaming, pause auto-scroll after delay
      if (scrollTimeout.value) {
        clearTimeout(scrollTimeout.value)
      }
      
      scrollTimeout.value = setTimeout(() => {
        if (!checkIfAtBottom() && isStreaming) {
          autoScrollPaused.value = true
        }
        scrollTimeout.value = null
      }, autoScrollDelay)
    }
  }

  // Auto-scroll logic for new content
  const handleNewContent = (isStreaming: boolean, hasNewMessages: boolean): void => {
    nextTick(() => {
      updateScrollDimensions()
      handleScroll()

      // Auto-scroll conditions
      if (hasNewMessages) {
        autoScrollPaused.value = false
        scrollToBottom(true, false) // Smooth scroll for new messages
        return
      }

      // During streaming, use throttled instant scroll
      if (isStreaming && isUserAtBottom.value && !autoScrollPaused.value) {
        scrollToBottomThrottled()
      }
    })
  }

  // Setup scroll listener and resize observer
  const setupScrollListeners = (): (() => void) => {
    if (!scrollContainer.value) return () => {}

    const element = scrollContainer.value
    element.addEventListener('scroll', handleScroll, { passive: true })

    const resizeObserver = new ResizeObserver(() => {
      nextTick(() => {
        updateScrollDimensions()
        handleScroll()
      })
    })

    if (element instanceof Element) {
      resizeObserver.observe(element)
    }

    // Return cleanup function
    return () => {
      element.removeEventListener('scroll', handleScroll)
      resizeObserver.disconnect()
      
      if (scrollTimeout.value) {
        clearTimeout(scrollTimeout.value)
        scrollTimeout.value = null
      }
      
      if (streamingScrollTimeout.value) {
        clearTimeout(streamingScrollTimeout.value)  
        streamingScrollTimeout.value = null
      }
      
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId)
        animationFrameId = null
      }
    }
  }

  // Initialize scroll on mount
  const initializeScroll = (): void => {
    nextTick(() => {
      scrollToBottom(false) // Instant scroll on initial load
      updateScrollDimensions()
      handleScroll()
    })
  }

  // Watch for message changes
  const watchForChanges = (messages: Ref<any[]>, status: Ref<string>) => {
    watch([messages, status], (newValues, oldValues) => {
      const [newMessages, newStatus] = newValues
      const [oldMessages, oldStatus] = oldValues || [[], 'idle']

      const hasNewMessages = newMessages && oldMessages && newMessages.length > oldMessages.length
      const isStreamingOrSubmitted = newStatus === 'streaming' || newStatus === 'submitted'
      const wasStreaming = oldStatus === 'streaming' || oldStatus === 'submitted'
      const streamingJustStarted = !wasStreaming && isStreamingOrSubmitted
      const streamingJustEnded = wasStreaming && !isStreamingOrSubmitted

      // Handle different scenarios
      if (streamingJustStarted || hasNewMessages) {
        handleNewContent(isStreamingOrSubmitted, hasNewMessages)
      } else if (isStreamingOrSubmitted) {
        handleScrollDuringStreaming(true)
        if (isUserAtBottom.value && !autoScrollPaused.value) {
          scrollToBottomThrottled() // Use throttled scroll during streaming
        }
      } else if (streamingJustEnded) {
        autoScrollPaused.value = false
      }
    }, { deep: true })

    // Watch for initial messages load
    watch(() => messages.value?.length, (newLength, oldLength) => {
      if (oldLength === 0 && newLength > 0) {
        setTimeout(() => {
          scrollToBottom(false)
          isUserAtBottom.value = true
          updateScrollDimensions()
          handleScroll()
        }, 100)
      } else if (newLength && oldLength && newLength > oldLength) {
        nextTick(() => {
          updateScrollDimensions()
          handleScroll()
        })
      }
    }, { immediate: true })
  }

  return {
    // Refs
    scrollContainer,
    
    // State
    isUserAtBottom: readonly(isUserAtBottom),
    isAutoScrolling: readonly(isAutoScrolling),
    autoScrollPaused: readonly(autoScrollPaused),
    
    // Computed
    hasScrollableContent,
    shouldShowScrollButton,
    
    // Methods
    scrollToBottom,
    scrollToBottomThrottled,
    handleScroll,
    updateScrollDimensions,
    setupScrollListeners,
    initializeScroll,
    watchForChanges,
  }
}