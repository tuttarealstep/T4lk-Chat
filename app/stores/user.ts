import { defineStore } from 'pinia'
import type { ApiKeys } from '#shared/types/api-keys'
import type { LLM_PROVIDERS, LLMInfo } from '#shared/ai/LLM';


interface UserPreferences {
  name: string
  occupation: string
  selectedTraits: string[]
  additionalInfo: string
  lastSelectedModel?: string | null
  statsForNerds: boolean
}

const STORAGE_KEYS = {
  USER_API_KEYS: 'userApiKeys',
  USER_PREFERENCES: 'userPreferences'
}

export const useUserStore = defineStore('user', () => {
  // ===== STATE =====
  const preferences = ref<UserPreferences>({
    name: '',
    occupation: '',
    selectedTraits: [],
    additionalInfo: '',
    lastSelectedModel: null,
    statsForNerds: false
  })

  const apiKeys = ref<ApiKeys | null>(null)
  const serverConfig = ref<Record<string, boolean> | null>(null)

  // Loading states
  const isLoadingPreferences = ref(false)
  const isLoadingServerConfig = ref(false)
  const isSavingPreferences = ref(false)
  const preferencesSaved = ref(false)

  // ===== COMPUTED =====

  // Check if user has API key for specific provider
  const hasApiKey = computed(() => (provider: string): boolean => {
    if (!apiKeys.value) return false

    switch (provider) {
      case 'openai':
        return !!apiKeys.value.openai
      case 'anthropic':
        return !!apiKeys.value.anthropic
      case 'azure':
        return !!(apiKeys.value.azure?.apiKey && apiKeys.value.azure?.deployments && Object.keys(apiKeys.value.azure.deployments).length > 0)
      case 'openrouter':
        return !!apiKeys.value.openrouter
      case 'google':
        return !!apiKeys.value.google
      case 'deepseek':
        return !!apiKeys.value.deepseek
      case 'xai':
        return !!apiKeys.value.xai
      default:
        return false
    }
  })

  // Check if model is available (has user API key or server config)
  const isModelAvailable = computed(() => (model: LLMInfo): boolean => {
    if (model.disabled) return false

    const hasUserApiKey = hasApiKey.value(model.provider)
    const hasServerConfig = serverConfig.value?.[model.provider] ?? false

    return hasUserApiKey || hasServerConfig
  })

  // Check if provider has credentials available
  const hasProviderCredentials = computed(() => (provider: LLM_PROVIDERS): boolean => {
    const hasUserApiKey = hasApiKey.value(provider)
    const hasServerConfig = serverConfig.value?.[provider] ?? false

    return hasUserApiKey || hasServerConfig
  })

  // ===== ACTIONS =====

  // Load server configuration
  const loadServerConfig = async (forceRefresh = false) => {
    if ((serverConfig.value !== null && !forceRefresh) || isLoadingServerConfig.value) return

    try {
      isLoadingServerConfig.value = true
      const config = await $fetch<Record<string, boolean>>('/api/server-config')
      serverConfig.value = config
    } catch (error) {
      console.error('Failed to load server config:', error)
      serverConfig.value = {}
    } finally {
      isLoadingServerConfig.value = false
    }
  }  // Load user preferences
  const loadPreferences = async (forceRefresh = false) => {
    // Skip if already loading or already loaded (unless forced refresh)
    if (isLoadingPreferences.value) return

    // Check if preferences are already loaded (not default values)
    const isAlreadyLoaded = preferences.value.name !== '' ||
      preferences.value.occupation !== '' ||
      preferences.value.selectedTraits.length > 0 ||
      preferences.value.additionalInfo !== '' ||
      preferences.value.lastSelectedModel !== null

    if (isAlreadyLoaded && !forceRefresh) return

    try {
      isLoadingPreferences.value = true
      const data = await $fetch('/api/user-preferences')
      if (data && typeof data === 'object' && 'name' in data) {
        preferences.value.name = data.name || ''
        preferences.value.occupation = data.occupation || ''
        preferences.value.selectedTraits = Array.isArray(data.selectedTraits) ? data.selectedTraits : []
        preferences.value.additionalInfo = data.additionalInfo || ''
        preferences.value.lastSelectedModel = data.lastSelectedModel || null
        preferences.value.statsForNerds = data.statsForNerds || false
      }
    } catch (error) {
      console.error('Failed to load user preferences:', error)
      // Reset to defaults on error
      preferences.value.name = ''
      preferences.value.occupation = ''
      preferences.value.selectedTraits = []
      preferences.value.additionalInfo = ''
      preferences.value.lastSelectedModel = null
      preferences.value.statsForNerds = false
    } finally {
      isLoadingPreferences.value = false
    }
  }

  // Save user preferences
  const savePreferences = async () => {
    if (isSavingPreferences.value) return

    try {
      isSavingPreferences.value = true
      preferencesSaved.value = false

      await $fetch('/api/user-preferences', {
        method: 'PATCH',
        body: preferences.value
      })

      preferencesSaved.value = true

      // Auto-hide success state after 2 seconds
      setTimeout(() => {
        preferencesSaved.value = false
      }, 2000)
    } catch (error) {
      console.error('Failed to save user preferences:', error)
      throw error
    } finally {
      isSavingPreferences.value = false
    }
  }

  // Save last selected model
  const saveLastSelectedModel = async (modelId: string) => {
    try {
      await $fetch('/api/user-preferences/last-selected-model', {
        method: 'POST', body: { modelId }
      })
      preferences.value.lastSelectedModel = modelId
    } catch (error) {
      console.error('Failed to save last selected model:', error)
      throw error
    }
  }

  // Load API keys from localStorage
  const loadApiKeys = () => {
    if (import.meta.client) {
      const stored = localStorage.getItem(STORAGE_KEYS.USER_API_KEYS)
      if (stored) {
        try {
          apiKeys.value = JSON.parse(stored)
        } catch (error) {
          console.error('Error parsing stored API keys:', error)
          apiKeys.value = null
        }
      }
    }
  }

  // Save API keys to localStorage
  const saveApiKeys = (keys: ApiKeys) => {
    if (!apiKeys.value) {
      apiKeys.value = keys
    } else {
      // Merge with existing keys
      apiKeys.value = { ...apiKeys.value, ...keys }
    }
    if (import.meta.client) {
      localStorage.setItem(STORAGE_KEYS.USER_API_KEYS, JSON.stringify(keys))
      // Trigger storage event for other tabs
      window.dispatchEvent(new StorageEvent('storage', {
        key: STORAGE_KEYS.USER_API_KEYS,
        newValue: JSON.stringify(keys)
      }))
    }
  }

  // Clear API keys
  const clearApiKeys = () => {
    apiKeys.value = null
    if (import.meta.client) {
      localStorage.removeItem(STORAGE_KEYS.USER_API_KEYS)
    }
  }

  // Get API keys for specific model
  const getApiKeyForModel = (model: LLMInfo): Partial<ApiKeys> | undefined => {

    //Load API keys if not already loaded
    loadApiKeys()

    if (!apiKeys.value) return undefined

    const result: Partial<ApiKeys> = {}

    switch (model.provider) {
      case 'openai':
        if (apiKeys.value.openai) result.openai = apiKeys.value.openai
        break
      case 'anthropic':
        if (apiKeys.value.anthropic) result.anthropic = apiKeys.value.anthropic
        break
      case 'google':
        if (apiKeys.value.google) result.google = apiKeys.value.google
        break
      case 'azure':
        if (apiKeys.value.azure) result.azure = apiKeys.value.azure
        break
      case 'openrouter':
        if (apiKeys.value.openrouter) result.openrouter = apiKeys.value.openrouter
        break
      case 'deepseek':
        if (apiKeys.value.deepseek) result.deepseek = apiKeys.value.deepseek
        break
      case 'xai':
        if (apiKeys.value.xai) result.xai = apiKeys.value.xai
        break
    }

    return Object.keys(result).length > 0 ? result : undefined
  }

  // Helper methods for managing traits
  const addTrait = (trait: string) => {
    if (!preferences.value.selectedTraits.includes(trait)) {
      preferences.value.selectedTraits = [...preferences.value.selectedTraits, trait]
    }
  }

  const removeTrait = (trait: string) => {
    preferences.value.selectedTraits = preferences.value.selectedTraits.filter(t => t !== trait)
  }

  const setTraits = (traits: string[]) => {
    preferences.value.selectedTraits = [...traits]
  }
  // Helper method to update any preference field
  const updatePreference = <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    preferences.value[key] = value
  }

  // Clear all user data (used when transitioning to anonymous)
  const clearUserData = () => {
    // Reset preferences to defaults
    preferences.value.name = ''
    preferences.value.occupation = ''
    preferences.value.selectedTraits = []
    preferences.value.additionalInfo = ''
    preferences.value.lastSelectedModel = null
    preferences.value.statsForNerds = false

    // Clear API keys
    clearApiKeys()

    // Clear localStorage
    if (import.meta.client) {
      localStorage.removeItem(STORAGE_KEYS.USER_PREFERENCES)
      localStorage.removeItem(STORAGE_KEYS.USER_API_KEYS)
    }

    // Reset loading states
    isLoadingPreferences.value = false
    isSavingPreferences.value = false
    preferencesSaved.value = false
  }

  // Initialize store (load data on client)
  const initialize = async () => {
    if (import.meta.client) {
      loadApiKeys()
      await Promise.all([
        loadServerConfig(),
        loadPreferences()
      ])
    }
  }

  // Listen for localStorage changes from other tabs
  if (import.meta.client) {
    window.addEventListener('storage', (event) => {
      if (event.key === STORAGE_KEYS.USER_API_KEYS) {
        loadApiKeys()
      }
    })
  }
  return {
    // State
    preferences,
    apiKeys,
    serverConfig,
    isLoadingPreferences,
    isLoadingServerConfig,
    isSavingPreferences,
    preferencesSaved,

    // Computed
    hasApiKey,
    isModelAvailable,
    hasProviderCredentials,

    // Actions
    initialize,
    loadServerConfig,
    loadPreferences,
    savePreferences,
    saveLastSelectedModel,
    loadApiKeys,
    saveApiKeys,
    clearApiKeys,
    getApiKeyForModel,    // Helper methods
    addTrait,
    removeTrait,
    setTraits,
    updatePreference,
    clearUserData
  }
})
