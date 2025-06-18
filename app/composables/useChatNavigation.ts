export function useChatNavigation() {
    const router = useRouter()

    const navigateToThread = async (threadId: string) => {
        try {
            await router.push(`/chat/${threadId}`)
        } catch (error) {
            console.error('Failed to navigate to thread:', error)
        }
    }

    const updateUrlToThread = (threadId: string, isStreaming = false) => {
        try {
            // Update URL without triggering navigation to avoid interrupting streaming
            const newUrl = `/chat/${threadId}`
            if (window.location.pathname !== newUrl) {
                window.history.replaceState(window.history.state, '', newUrl)

                // During streaming, only update the browser URL
                // After streaming completes, sync the router state
                if (!isStreaming) {
                    // Use nextTick to ensure it happens after the current operation
                    nextTick(() => {
                        try {
                            // Update router's internal state to match the new URL
                            router.replace({
                                path: newUrl,
                                query: router.currentRoute.value.query
                            }).catch(() => {
                                // Ignore navigation errors
                                // The important thing is that the URL is updated
                            })
                        } catch (error) {
                            console.warn('Router sync failed:', error)
                        }
                    })
                }
            }
        } catch (error) {
            console.error('Failed to update URL to thread:', error)        }
    }

    const navigateToNewChat = async () => {
        try {
            await router.push('/')
        } catch (error) {
            console.error('Failed to navigate to new chat:', error)
        }
    }

    const syncRouterToCurrentUrl = () => {
        try {
            const currentPath = window.location.pathname
            const routerPath = router.currentRoute.value.path
            
            if (currentPath !== routerPath) {
                router.replace({
                    path: currentPath,
                    query: router.currentRoute.value.query
                }).catch((error) => {
                    console.warn('Failed to sync router with current URL:', error)
                })
            }
        } catch (error) {
            console.error('Failed to sync router to current URL:', error)
        }
    }

    return {
        navigateToThread,
        updateUrlToThread,
        navigateToNewChat,
        syncRouterToCurrentUrl
    }
}
