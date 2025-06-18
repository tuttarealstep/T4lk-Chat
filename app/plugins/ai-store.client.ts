export default defineNuxtPlugin(async () => {
    if (import.meta.client) {
        const aiStore = useAiStore()

        // Load favorite models on app startup
        await aiStore.loadFavoriteModels()
    }
})
