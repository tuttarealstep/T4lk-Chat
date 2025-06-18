// Global state for command palette
const globalState = {
    isOpen: ref(false),
    searchQuery: ref(''),
    selectedIndex: ref(0),
    isInitialized: false
}

export function useCommandPalette() {
    const { navigateToNewChat, navigateToThread } = useChatNavigation()
    const chatStore = useChatStore()

    // Use global state
    const isOpen = globalState.isOpen
    const searchQuery = globalState.searchQuery
    const selectedIndex = globalState.selectedIndex

    // Filter threads based on search query
    const filteredThreads = computed(() => {
        if (!searchQuery.value.trim()) {
            return chatStore.threads.slice(0, 10) // Show only recent 10 threads when no search
        }

        const query = searchQuery.value.toLowerCase().trim()
        return chatStore.threads.filter(thread =>
            thread.title.toLowerCase().includes(query)
        ).slice(0, 10) // Limit to 10 results
    })    // Reset state when opening/closing
    const openPalette = () => {
        console.log('Opening command palette')
        isOpen.value = true
        searchQuery.value = ''
        selectedIndex.value = 0
    }

    const closePalette = () => {
        isOpen.value = false
        searchQuery.value = ''
        selectedIndex.value = 0
    }    // Handle keyboard navigation
    const handleKeyDown = (event: KeyboardEvent) => {
        if (!isOpen.value) return

        const totalItems = filteredThreads.value.length + (searchQuery.value.trim() ? 1 : 0)
        const maxIndex = Math.max(0, totalItems - 1)

        switch (event.key) {
            case 'Escape':
                event.preventDefault()
                closePalette()
                break
            case 'ArrowDown':
                event.preventDefault()
                selectedIndex.value = Math.min(selectedIndex.value + 1, maxIndex)
                break
            case 'ArrowUp':
                event.preventDefault()
                selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
                break
            case 'Enter':
                event.preventDefault()
                handleSelect()
                break
        }
    }

    // Handle selection (Enter key or click)
    const handleSelect = async () => {
        if (selectedIndex.value === 0 && searchQuery.value.trim()) {
            // Create new chat with the search query as initial message
            await createNewChatWithMessage(searchQuery.value.trim())        } else if (filteredThreads.value[selectedIndex.value - (searchQuery.value.trim() ? 1 : 0)]) {
            // Navigate to selected thread
            const thread = filteredThreads.value[selectedIndex.value - (searchQuery.value.trim() ? 1 : 0)]
            if (thread) {
                await navigateToThread(thread.id)
            }
        }
        closePalette()
    }

    // Create new chat with initial message
    const createNewChatWithMessage = async (message: string) => {
        try {
            // Navigate to new chat page
            await navigateToNewChat()
            
            // Wait for navigation to complete and then trigger the message
            await nextTick()
            
            // Emit event to send the message
            const event = new CustomEvent('sendInitialMessage', { 
                detail: { message } 
            })
            window.dispatchEvent(event)
        } catch (error) {
            console.error('Failed to create new chat with message:', error)
        }
    }

    // Handle global keyboard shortcuts
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
            event.preventDefault()
            if (isOpen.value) {
                closePalette()
            } else {
                openPalette()
            }
        }
    }    // Setup global event listeners (only once)
    if (import.meta.client && !globalState.isInitialized) {
        globalState.isInitialized = true
        
        document.addEventListener('keydown', handleGlobalKeyDown)
        document.addEventListener('keydown', handleKeyDown)
        
        // Cleanup when window unloads
        window.addEventListener('beforeunload', () => {
            document.removeEventListener('keydown', handleGlobalKeyDown)
            document.removeEventListener('keydown', handleKeyDown)
        })
    }

    return {
        isOpen: readonly(isOpen),
        searchQuery,
        selectedIndex,
        filteredThreads,
        openPalette,
        closePalette,
        handleSelect,
        handleKeyDown
    }
}
