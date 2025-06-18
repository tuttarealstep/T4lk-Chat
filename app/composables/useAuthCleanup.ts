/**
 * Composable for cleaning up user data when transitioning to anonymous mode
 */
export function useAuthCleanup() {
  
  const clearAllUserData = () => {
    // Get all stores
    const userStore = useUserStore()
    const chatStore = useChatStore()
    const aiStore = useAiStore()

    // Clear all store data
    userStore.clearUserData()
    chatStore.clearChatData()
    aiStore.clearAiData()

    // Clear any additional localStorage items that might exist
    if (import.meta.client) {
      // Clear any other potential localStorage items
      const keysToRemove = [
        'userApiKeys',
        'userPreferences',
        'openchat_favorite_models',
        'openchat_favorite_models_timestamp',
        'pinia' // Clear entire Pinia cache
      ]

      keysToRemove.forEach(key => {
        localStorage.removeItem(key)
      })

      // Clear sessionStorage as well
      sessionStorage.clear()

      // Force reload of stores to ensure clean state
      nextTick(async () => {
        await userStore.initialize()
        await aiStore.loadFavoriteModels()
        await chatStore.initialize()
      })
    }
  }

  return {
    clearAllUserData
  }
}
