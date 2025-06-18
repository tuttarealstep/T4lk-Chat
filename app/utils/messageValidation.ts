import { useAiStore } from '~/stores/ai'

/**
 * Utility functions for message validation
 */

// Calculate max characters for current model
export const getMaxCharactersForModel = (modelId: string): number => {
    const aiStore = useAiStore()
    const model = aiStore.llms[modelId]
    if (!model) return 4000 // Default fallback

    // Rough estimation: 1 token ≈ 4 characters for most models
    // Leave some buffer for system messages and formatting
    return Math.floor(model.limits.maxInputTokens * 3.5)
}

// Validate message length (returns validation result, let components handle i18n)
export const validateMessageLength = (text: string, modelId: string): { valid: boolean, current?: number, max?: number } => {
    const maxChars = getMaxCharactersForModel(modelId)
    if (text.length > maxChars) {
        return { valid: false, current: text.length, max: maxChars }
    }
    return { valid: true }
}
