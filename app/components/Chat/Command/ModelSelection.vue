<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, inject, type Ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command'
import { Badge } from '~/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { LLM_FEATURES, type LLMInfo } from '~~/shared/ai/LLM'
import { useAiStore } from '~/stores/ai'
import { useModelFromUrl } from '~/composables/useModelFromUrl'
import { toast } from 'vue-sonner'
import { useUserStore } from '~/stores/user'
import ChatDialogApiKeysSetup from '~/components/Chat/Dialog/ApiKeysSetup.vue'

const { t } = useI18n()
const aiStore = useAiStore()
const userStore = useUserStore()
const { setModelInUrl } = useModelFromUrl()
const searchQuery = ref('')
const selectedFilters = ref<string[]>([])

// Get injected selectedModel ref
const injectedSelectedModel = inject('selectedModel', null) as Ref<string> | null

// Available filters based on LLM_FEATURES
const availableFilters = [
    { id: LLM_FEATURES.FAST, label: 'Fast', icon: 'lucide:zap', description: t('chat.features.fast') },
    { id: LLM_FEATURES.VISION, label: 'Vision', icon: 'lucide:eye', description: t('chat.features.vision') },
    { id: LLM_FEATURES.SEARCH, label: 'Search', icon: 'lucide:search', description: t('chat.features.search') },
    { id: LLM_FEATURES.PDFS, label: 'PDFs', icon: 'lucide:file-text', description: t('chat.features.pdfs') },
    { id: LLM_FEATURES.REASONING, label: 'Reasoning', icon: 'lucide:brain', description: t('chat.features.reasoning') },
    { id: LLM_FEATURES.REASONING_EFFORT, label: 'Effort Control', icon: 'lucide:settings', description: t('chat.features.effort_control') },
    { id: LLM_FEATURES.IMAGES, label: 'Image Generation', icon: 'lucide:image', description: t('chat.features.image_generation') }
]

// Computed models based on search and filters
const filteredModels = computed(() => {
    let models = aiStore.getModelsWithCredentials

    // Apply search filter
    if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase()
        models = models.filter(model =>
            model.name.toLowerCase().includes(query) ||
            model.developer.toLowerCase().includes(query) ||
            model.modelKey.toLowerCase().includes(query)
        )
    }    // Apply feature filters
    if (selectedFilters.value.length > 0) {
        models = models.filter(model =>
            selectedFilters.value.every(filter =>
                model.features.includes(filter as LLM_FEATURES)
            )
        )
    }

    return models
})

// Toggle filter selection
const toggleFilter = (filterId: string) => {
    const index = selectedFilters.value.indexOf(filterId)
    if (index > -1) {
        selectedFilters.value.splice(index, 1)
    } else {
        selectedFilters.value.push(filterId)
    }
}

// Clear all filters
const clearFilters = () => {
    selectedFilters.value = []
}

// Toggle favorite status
const toggleFavorite = async (modelKey: string) => {
    try {
        await aiStore.toggleFavorite(modelKey)
        toast.success(
            aiStore.favoriteModels.includes(modelKey)
                ? t('chat.added_to_favorites')
                : t('chat.removed_from_favorites')
        )
    } catch (_error) {
        toast.error(t('chat.failed_to_update_favorites'))
    }
}

// Select model
const selectModel = (modelKey: string, options: { hasCredentials?: boolean; isAccessible?: boolean } = {}) => {
    const modelInfo = aiStore.llms[modelKey]

    if (!modelInfo) {
        toast.error(t('chat.model_not_found', { model: modelKey }))
        return
    }

    // Verifica se il modello è accessibile
    if (modelInfo && !options.hasCredentials) {
        toast.error(t('chat.model_requires_api_key', { model: modelInfo.name, provider: modelInfo.provider }))
        return
    }

    // Update the injected selectedModel if available
    if (injectedSelectedModel) {
        injectedSelectedModel.value = modelKey
    }

    // Also update the store for consistency
    aiStore.selectedModel = modelKey

    // Update URL with selected model
    setModelInUrl(modelKey)

    // Emit selection event
    emit('modelSelected', modelKey, options)

    // Close the popover after selection
    emit('close')

    toast.success(t('chat.model_selected', { model: modelInfo.name }))
}

// Define emits
const emit = defineEmits<{
    modelSelected: [model: string, options?: { hasCredentials?: boolean; isAccessible?: boolean }]
    close: []
}>()

// Get provider icon
const getProviderIcon = (provider: string) => {
    const icons: Record<string, string> = {
        'openai': 'simple-icons:openai',
        'anthropic': 'simple-icons:anthropic',
        'google': 'simple-icons:google',
        'azure': 'simple-icons:microsoftazure',
        'openrouter': 'lucide:route',
        'deepseek': 'lucide:search',
        'xai': 'lucide:x'
    }
    return icons[provider] || 'lucide:cpu'
}

// Get feature icon and description
const getFeatureIcon = (feature: string) => {
    const filter = availableFilters.find(f => f.id === feature)
    return filter?.icon || 'lucide:circle'
}

const getFeatureDescription = (feature: string) => {
    const filter = availableFilters.find(f => f.id === feature)
    return filter?.description || feature
}

const filteredFeatures = (model: LLMInfo) => {
    // todo needs to add parameters customization feature
    return model.features.filter(feature => feature !== LLM_FEATURES.PARAMETERS)
}

// Count models without credentials
const modelsWithoutCredentials = computed(() => {
    return filteredModels.value.filter(model => !model.hasCredentials).length
})

// Handle API keys updates
const handleApiKeysUpdate = async (event: StorageEvent) => {
    // Only handle userApiKeys changes
    if (event.key === 'userApiKeys') {
        // Force refresh of models with credentials
        aiStore.refreshModelAvailability()

        // Also refresh user store to ensure API keys are loaded
        userStore.loadApiKeys()

        // Force re-evaluation of server config
        await userStore.loadServerConfig(true)

        // Force re-evaluation with nextTick
        await nextTick()
    }
}

// Listen for API keys updates
onMounted(() => {
    window.addEventListener('storage', handleApiKeysUpdate)
})

onUnmounted(() => {
    window.removeEventListener('storage', handleApiKeysUpdate)
})

// Watch for API keys changes to ensure model availability is updated
watch(() => userStore.apiKeys, () => {
    // Force refresh when API keys change
    aiStore.refreshModelAvailability()
}, { deep: true })

// Watch for server config changes
watch(() => userStore.serverConfig, () => {
    // Force refresh when server config changes
    aiStore.refreshModelAvailability()
}, { deep: true })

</script>

<template>
    <TooltipProvider>
        <Command class="h-full">
            <div class="flex flex-row items-center">
                <div class="flex-1">
                    <CommandInput v-model="searchQuery" :placeholder="t('chat.search_models')" class="h-9" />
                </div>
                <div class="border-b h-12 flex items-center px-2">
                    <!-- Filters -->
                    <Popover>
                        <PopoverTrigger as-child>
                            <Button variant="outline" size="icon" class="ml-2 relative cursor-pointer"
                                :aria-label="t('chat.filter_models')">
                                <div class="absolute rounded-full pointer-events-none bg-muted h-2 w-2 -right-1 -top-1"
                                    :class="{ 'bg-primary': selectedFilters.length > 0, 'hidden': selectedFilters.length === 0 }" />
                                <Icon name="lucide:filter" class="size-4" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent class="w-60 p-0">
                            <div class="p-3">
                                <div class="flex flex-wrap gap-2">
                                    <Tooltip v-for="filter in availableFilters" :key="`popover-filter-${filter.id}`">
                                        <TooltipTrigger as-child>
                                            <Button variant="outline" size="sm" class="cursor-pointer w-full"
                                                @click="toggleFilter(filter.id)">
                                                <div class="flex items-center w-full gap-2">
                                                    <Icon :name="filter.icon" class="size-3 mr-1" />
                                                    {{ filter.label }}
                                                </div>
                                                <div>
                                                    <Icon v-if="selectedFilters.includes(filter.id)" name="lucide:check"
                                                        class="size-3 text-primary-foreground" />
                                                </div>
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            {{ filter.description }}
                                        </TooltipContent>
                                    </Tooltip>
                                </div> <Button v-if="selectedFilters.length > 0" variant="ghost" size="sm"
                                    class="mt-2 w-full cursor-pointer" @click="clearFilters">
                                    {{ t('chat.clear_filters') }}
                                </Button>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
            </div>
            <CommandList class="max-h-[400px]">
                <CommandEmpty>
                    <div v-if="aiStore.isLoadingFavorites" class="flex items-center justify-center py-8">
                        <div class="flex items-center gap-2">
                            <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                            <span class="text-sm text-muted-foreground">{{ t('chat.loading_models') }}</span>
                        </div>
                    </div>
                    <div v-else>{{ t('chat.no_models_found') }}</div>
                </CommandEmpty>
                <!-- Favorites Section -->
                <CommandGroup v-if="filteredModels.filter(m => aiStore.favoriteModels.includes(m.modelKey)).length > 0"
                    :heading="t('chat.favorites')">
                    <CommandItem
                        v-for="model in filteredModels.filter(m => aiStore.favoriteModels.includes(m.modelKey))"
                        :key="`fav-${model.modelKey}`" :value="model.modelKey" class="cursor-pointer group"
                        :class="{ 'opacity-50': !model.hasCredentials }"
                        @select="selectModel(model.modelKey, { hasCredentials: model.hasCredentials, isAccessible: model.isAccessible })">
                        <div class="flex items-center justify-between w-full">
                            <div class="flex items-center gap-3">
                                <Icon :name="getProviderIcon(model.provider)" class="!size-4 flex-shrink-0" />
                                <div class="flex flex-col min-w-0">
                                    <div class="flex items-center gap-2">
                                        <span class="font-medium">{{ model.name }}</span>
                                        <Badge v-if="model.version" variant="secondary" class="text-xs">
                                            {{ model.version }}
                                        </Badge>
                                        <Badge v-if="model.experimental" variant="secondary" class="text-xs">
                                            {{ t('chat.experimental') }}
                                        </Badge>
                                    </div>
                                    <div class="flex items-center gap-1 mt-1">
                                        <span class="text-xs text-muted-foreground">{{ model.developer }}</span>
                                        <span class="text-xs text-muted-foreground">{{ model.provider }}</span>
                                        <div class="flex gap-1">
                                            <Tooltip v-for="feature in filteredFeatures(model)"
                                                :key="`${model.modelKey}-${feature}`">
                                                <TooltipTrigger as-child>
                                                    <Icon :name="getFeatureIcon(feature)"
                                                        class="size-3 text-muted-foreground cursor-help" />
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    {{ getFeatureDescription(feature) }}
                                                </TooltipContent>
                                            </Tooltip>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="flex items-center gap-1">
                                <Tooltip v-if="!model.hasCredentials">
                                    <TooltipTrigger as-child>
                                        <Icon name="lucide:key" class="!size-4 text-destructive" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        {{ t('chat.api_key_required', { provider: model.provider }) }}
                                    </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger as-child>
                                        <Button variant="ghost" size="icon" class="size-6 cursor-pointer"
                                            @click.stop="toggleFavorite(model.modelKey)">
                                            <Icon name="lucide:pin-off" class="!size-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        {{ t('chat.remove_from_favorites') }}
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                        </div>
                    </CommandItem>
                </CommandGroup> <!-- All Models Section -->
                <CommandGroup :heading="t('chat.all_models')">
                    <CommandItem
                        v-for="model in filteredModels.filter(m => !aiStore.favoriteModels.includes(m.modelKey))"
                        :key="model.modelKey" :value="model.modelKey" class="cursor-pointer group"
                        :class="{ 'opacity-50': !model.hasCredentials }"
                        @select="selectModel(model.modelKey, { hasCredentials: model.hasCredentials, isAccessible: model.isAccessible })">
                        <div class="flex items-center justify-between w-full">
                            <div class="flex items-center gap-3">
                                <Icon :name="getProviderIcon(model.provider)" class="!size-4 flex-shrink-0" />
                                <div class="flex flex-col min-w-0">
                                    <div class="flex items-center gap-2">
                                        <span class="font-medium">{{ model.name }}</span>
                                        <Badge v-if="model.version" variant="secondary" class="text-xs">
                                            {{ model.version }}
                                        </Badge>
                                        <span v-if="model.additionalInfo" class="font-medium text-primary">({{
                                            model.additionalInfo }})</span>
                                        <Badge v-if="model.experimental" variant="secondary" class="text-xs">
                                            {{ t('chat.experimental') }}
                                        </Badge>
                                    </div>
                                    <div class="flex items-center gap-1 mt-1">
                                        <span class="text-xs text-muted-foreground">{{ model.developer }}</span>
                                        <div class="flex gap-1">
                                            <Tooltip v-for="feature in filteredFeatures(model)"
                                                :key="`${model.modelKey}-${feature}`">
                                                <TooltipTrigger as-child>
                                                    <Icon :name="getFeatureIcon(feature)"
                                                        class="size-3 text-muted-foreground cursor-help" />
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    {{ getFeatureDescription(feature) }}
                                                </TooltipContent>
                                            </Tooltip>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="flex items-center gap-1">
                                <Tooltip v-if="!model.hasCredentials">
                                    <TooltipTrigger as-child>
                                        <Icon name="lucide:key" class="!size-4 text-destructive" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        {{ t('chat.api_key_required', { provider: model.provider }) }}
                                    </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger as-child>
                                        <Button variant="ghost" size="icon"
                                            class="size-6 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                            @click.stop="toggleFavorite(model.modelKey)">
                                            <Icon name="lucide:pin" class="!size-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        {{ t('chat.add_to_favorites') }}
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                        </div>
                    </CommandItem>
                </CommandGroup>
            </CommandList>
        </Command>
    </TooltipProvider>

    <!-- API Keys Setup Section -->
    <div class="border-t p-3 mt-3">
        <div class="flex items-center justify-between">
            <div class="text-sm text-muted-foreground">
                <span v-if="modelsWithoutCredentials > 0">
                    {{ t('chat.models_require_api_keys', { count: modelsWithoutCredentials }) }}
                </span>
                <span v-else>
                    {{ t('chat.all_models_accessible') }}
                </span>
            </div>
            <ChatDialogApiKeysSetup />
        </div>
    </div>
</template>