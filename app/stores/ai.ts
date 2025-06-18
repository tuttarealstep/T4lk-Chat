import { defineStore } from 'pinia'
import { LLMs, type LLMInfo } from '~~/shared/ai/LLM'

const STORAGE_KEYS = {
    FAVORITE_MODELS: 'openchat_favorite_models',
    FAVORITE_MODELS_TIMESTAMP: 'openchat_favorite_models_timestamp'
}

const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export const useAiStore = defineStore('ai', () => {
    const llms = shallowRef<Record<string, LLMInfo>>(LLMs);
    const favoriteModels = ref<string[]>([]);
    const selectedModel = ref<string>('');
    const isLoadingFavorites = ref<boolean>(false);
    // Add a reactive trigger to force recomputation
    const modelAvailabilityTrigger = ref(0);

    // Load favorite models from localStorage or API
    const loadFavoriteModels = async (forceRefresh = false) => {
        if (isLoadingFavorites.value) return;

        try {
            isLoadingFavorites.value = true;

            // Check localStorage first (only on client side)
            if (import.meta.client && !forceRefresh) {
                const cached = localStorage.getItem(STORAGE_KEYS.FAVORITE_MODELS);
                const timestamp = localStorage.getItem(STORAGE_KEYS.FAVORITE_MODELS_TIMESTAMP);

                if (cached && timestamp) {
                    const age = Date.now() - parseInt(timestamp);
                    if (age < CACHE_DURATION) {
                        favoriteModels.value = JSON.parse(cached);
                        return;
                    }
                }
            }

            // Fetch from API
            const data = await $fetch<string[]>('/api/favorite-models');
            favoriteModels.value = data || [];

            // Save to localStorage (only on client side)
            if (import.meta.client) {
                localStorage.setItem(STORAGE_KEYS.FAVORITE_MODELS, JSON.stringify(favoriteModels.value));
                localStorage.setItem(STORAGE_KEYS.FAVORITE_MODELS_TIMESTAMP, Date.now().toString());
            }
        } catch (error) {
            console.error('Failed to load favorite models:', error);
        } finally {
            isLoadingFavorites.value = false;
        }
    };

    // Add model to favorites
    const addToFavorites = async (modelId: string) => {
        try {
            await $fetch('/api/favorite-models', {
                method: 'POST',
                body: { modelId }
            });
            if (!favoriteModels.value.includes(modelId)) {
                favoriteModels.value.push(modelId);
            }

            // Update localStorage
            if (import.meta.client) {
                localStorage.setItem(STORAGE_KEYS.FAVORITE_MODELS, JSON.stringify(favoriteModels.value));
                localStorage.setItem(STORAGE_KEYS.FAVORITE_MODELS_TIMESTAMP, Date.now().toString());
            }
        } catch (error) {
            console.error('Failed to add to favorites:', error);
            throw error;
        }
    };

    // Remove model from favorites
    const removeFromFavorites = async (modelId: string) => {
        try {
            await $fetch('/api/favorite-models', {
                method: 'DELETE',
                body: { modelId }
            });
            favoriteModels.value = favoriteModels.value.filter(id => id !== modelId);

            // Update localStorage
            if (import.meta.client) {
                localStorage.setItem(STORAGE_KEYS.FAVORITE_MODELS, JSON.stringify(favoriteModels.value));
                localStorage.setItem(STORAGE_KEYS.FAVORITE_MODELS_TIMESTAMP, Date.now().toString());
            }
        } catch (error) {
            console.error('Failed to remove from favorites:', error);
            throw error;
        }
    };    // Toggle favorite status
    const toggleFavorite = async (modelId: string) => {
        if (favoriteModels.value.includes(modelId)) {
            await removeFromFavorites(modelId);
        } else {
            await addToFavorites(modelId);
        }
    };

    // Function to force model availability refresh
    const refreshModelAvailability = () => {
        modelAvailabilityTrigger.value += 1
    }    // Get favorite models with details
    const getFavoriteModels = computed(() => {
        return favoriteModels.value
            .map(modelKey => ({ 
                ...llms.value[modelKey], 
                modelKey 
            }))
            .filter((model): model is LLMInfo & { modelKey: string } => Boolean(model))
            .filter(model => !model.disabled);
    });

    // Get all available models
    const getAvailableModels = computed(() => {
        return Object.values(llms.value).filter(model => !model.disabled);
    });    // Get models with credential information
    const getModelsWithCredentials = computed(() => {
        const userStore = useUserStore()
        // Include the trigger to force recomputation when API keys change
        void modelAvailabilityTrigger.value

        return Object.entries(llms.value).map(([modelKey, model]) => ({
            ...model,
            modelKey, // Add the key for identification
            hasCredentials: userStore.isModelAvailable(model),
            isAccessible: !model.disabled && userStore.isModelAvailable(model)
        }))
    });

    // Get only accessible models (have credentials and not disabled)
    const getAccessibleModels = computed(() => {
        return getModelsWithCredentials.value.filter(model => model.isAccessible);
    });// Watch for API keys changes and refresh model availability
    if (import.meta.client) {
        const userStore = useUserStore()

        // Listen for storage changes (API keys)
        window.addEventListener('storage', (event) => {
            if (event.key === 'userApiKeys') {
                // Force reactivity update by refreshing server config
                userStore.loadServerConfig(true)

                // Force reload of API keys to ensure store is updated
                userStore.loadApiKeys()

                // Force model availability refresh
                refreshModelAvailability()

                // Trigger a re-evaluation of computed properties by updating a reactive ref
                nextTick(() => {
                    // Force re-computation by accessing the computed properties
                    void getModelsWithCredentials.value
                    void getAccessibleModels.value
                })
            }
        });
    }

    // Listen for localStorage changes from other tabs
    if (import.meta.client) {
        window.addEventListener('storage', (event) => {
            if (event.key === STORAGE_KEYS.FAVORITE_MODELS && event.newValue) {
                try {
                    favoriteModels.value = JSON.parse(event.newValue);
                } catch (error) {
                    console.error('Failed to parse favorite models from storage event:', error);
                }
            }
        });
    }    // Clear all AI data (used when transitioning to anonymous)
    const clearAiData = () => {
        favoriteModels.value = []
        selectedModel.value = ''
        isLoadingFavorites.value = false

        // Clear localStorage caches
        if (import.meta.client) {
            localStorage.removeItem(STORAGE_KEYS.FAVORITE_MODELS)
            localStorage.removeItem(STORAGE_KEYS.FAVORITE_MODELS_TIMESTAMP)
        }
    }

    return {
        llms,
        favoriteModels,
        selectedModel,
        isLoadingFavorites,
        modelAvailabilityTrigger,
        loadFavoriteModels,
        addToFavorites,
        removeFromFavorites,
        toggleFavorite,
        getFavoriteModels,        getAvailableModels,
        getModelsWithCredentials,
        getAccessibleModels,
        refreshModelAvailability,
        clearAiData
    }
});