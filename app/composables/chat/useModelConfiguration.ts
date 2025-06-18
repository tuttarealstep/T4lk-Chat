import { useAiStore } from '~/stores/ai'
import { useUserStore } from '~/stores/user'
import { useModelFromUrl } from '~/composables/useModelFromUrl'
import { defaultLLM, LLM_FEATURES } from '#shared/ai/LLM'
import { toast } from 'vue-sonner'
import { useI18n } from 'vue-i18n'

export function useModelConfiguration() {
  const aiStore = useAiStore()
  const userStore = useUserStore()
  const { getModelFromUrl } = useModelFromUrl()
  const { t } = useI18n()

  // Model selection state
  const selectedModel = ref<string>('')
  
  // Configuration states
  const reasoningConfig = ref<Record<string, any>>({})
  const webSearchEnabled = ref(false)
  const imageGenerationConfig = ref<Record<string, any>>({
    n: 1,
    size: '1024x1024',
    openai: {
      quality: 'auto',
      background: 'auto',
      output_format: 'png',
      output_compression: 100,
      moderation: 'auto'
    }
  })

  // Get initial model from URL, preferences, or default
  const getInitialModel = (): string => {
    const urlModel = getModelFromUrl()

    // Priority 1: URL model parameter
    if (urlModel && aiStore.llms[urlModel] && !aiStore.llms[urlModel].disabled) {
      const model = aiStore.llms[urlModel]
      if (userStore.isModelAvailable(model)) {
        return urlModel
      }
    }

    // Priority 2: Last selected model from preferences
    if (userStore.preferences.lastSelectedModel) {
      const lastModel = userStore.preferences.lastSelectedModel
      if (lastModel && aiStore.llms[lastModel] && !aiStore.llms[lastModel].disabled) {
        const model = aiStore.llms[lastModel]
        if (userStore.isModelAvailable(model)) {
          return lastModel
        }
      }
    }

    // Priority 3: First available model
    const accessibleModel = Object.keys(aiStore.llms).find(modelId => {
      const llm = aiStore.llms[modelId]
      return llm && !llm.disabled && userStore.isModelAvailable(llm)
    })

    return accessibleModel || aiStore.selectedModel || defaultLLM
  }

  // Initialize model selection
  const initializeModel = (): void => {
    selectedModel.value = getInitialModel()
  }

  // Get selected model info
  const selectedModelInfo = computed(() => {
    void aiStore.modelAvailabilityTrigger // Force re-evaluation
    
    if (!selectedModel.value) return null
    return aiStore.getModelsWithCredentials.find(model => model.modelKey === selectedModel.value)
  })

  // Model display name
  const selectedModelDisplayName = computed(() => {
    return selectedModelInfo.value?.name || t('chat.select_model')
  })

  // Model validation
  const isModelSelected = computed(() => {
    return Boolean(selectedModel.value && selectedModelInfo.value?.hasCredentials)
  })

  // Feature checks
  const supportsReasoningEffort = computed(() => {
    const hasReasoning = selectedModelInfo.value?.features.includes(LLM_FEATURES.REASONING) || false
    const hasReasoningEffort = selectedModelInfo.value?.features.includes(LLM_FEATURES.REASONING_EFFORT) || false
    return hasReasoning || hasReasoningEffort
  })

  const supportsWebSearch = computed(() => {
    return selectedModelInfo.value?.features.includes(LLM_FEATURES.SEARCH) || false
  })

  const supportsImages = computed(() => {
    return selectedModelInfo.value?.features.includes(LLM_FEATURES.IMAGES) || false
  })

  const supportsAttachments = computed(() => {
    const supportsPdfs = selectedModelInfo.value?.features.includes(LLM_FEATURES.PDFS) || false
    const supportsVision = selectedModelInfo.value?.features.includes(LLM_FEATURES.VISION) || false
    return supportsPdfs || supportsVision
  })

  // Watch for model changes and save to preferences
  watch(selectedModel, (newModel) => {
    if (newModel) {
      aiStore.selectedModel = newModel
      userStore.saveLastSelectedModel(newModel)
    }
  })

  // Reset reasoning config when provider changes
  watch(selectedModel, (newModel, oldModel) => {
    if (newModel && oldModel && newModel !== oldModel) {
      const newModelInfo = aiStore.llms[newModel]
      const oldModelInfo = aiStore.llms[oldModel]

      if (newModelInfo?.provider !== oldModelInfo?.provider) {
        reasoningConfig.value = {}
      }
    }
  })

  // Watch for URL model changes
  const route = useRoute()
  watch(() => route.query.model, (newModelId) => {
    if (newModelId && typeof newModelId === 'string' && aiStore.llms[newModelId] && !aiStore.llms[newModelId].disabled) {
      const model = aiStore.llms[newModelId]
      if (userStore.isModelAvailable(model)) {
        selectedModel.value = newModelId
        aiStore.selectedModel = newModelId
      } else {
        toast.error(t('chat.model_requires_api_key', { 
          model: model.name, 
          provider: model.provider 
        }))
      }
    }
  })

  // Watch for API keys changes to refresh model availability
  watch(() => userStore.apiKeys, () => {
    aiStore.refreshModelAvailability()
  }, { deep: true })

  watch(() => userStore.serverConfig, () => {
    aiStore.refreshModelAvailability()
  }, { deep: true })

  // Build model parameters for API call
  const buildModelParams = () => {
    const modelParams: any = { ...reasoningConfig.value }
    
    if (webSearchEnabled.value) {
      modelParams.webSearch = true
    }
    
    if (supportsImages.value && imageGenerationConfig.value) {
      modelParams.imageGeneration = imageGenerationConfig.value
    }
    
    return modelParams
  }

  // Update preferences on mount
  const updateFromPreferences = async (): Promise<void> => {
    if (!getModelFromUrl() && userStore.preferences.lastSelectedModel) {
      const lastModel = userStore.preferences.lastSelectedModel
      
      if (lastModel && aiStore.llms[lastModel] && !aiStore.llms[lastModel].disabled) {
        const model = aiStore.llms[lastModel]
        if (userStore.isModelAvailable(model)) {
          selectedModel.value = lastModel
          aiStore.selectedModel = lastModel
        }
      }
    }
  }

  return {
    // State
    selectedModel,
    reasoningConfig,
    webSearchEnabled,
    imageGenerationConfig,
    
    // Computed
    selectedModelInfo,
    selectedModelDisplayName,
    isModelSelected,
    supportsReasoningEffort,
    supportsWebSearch,
    supportsImages,
    supportsAttachments,
    
    // Methods
    initializeModel,
    updateFromPreferences,
    buildModelParams,
  }
}