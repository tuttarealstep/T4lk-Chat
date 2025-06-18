export default defineNuxtPlugin(async () => {
  // Initialize stores on app startup
  if (import.meta.client) {
    const userStore = useUserStore()
    const aiStore = useAiStore()
    const chatStore = useChatStore()

    // Initialize user store first (API keys, preferences, etc.)
    await userStore.initialize()
    
    // Then initialize AI store (needs user store for credentials)
    await aiStore.loadFavoriteModels()
    
    // Finally initialize chat store
    await chatStore.initialize()
  }
})
