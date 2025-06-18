<script setup lang="ts">
import { ref, computed } from 'vue'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuPortal,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '~/components/ui/badge'
import { useAiStore } from '~/stores/ai'
import { useUserStore } from '~/stores/user'
import type { LLMInfo } from '~~/shared/ai/LLM'
import { useI18n } from 'vue-i18n'

interface Props {
    currentModel?: string
    messageRole: 'user' | 'assistant'
    disabled?: boolean
}

interface Emits {
    'retry': [modelKey?: string]
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()
const aiStore = useAiStore()

// Get available models with credentials grouped by provider
const modelsByProvider = computed(() => {
    const providers: Record<string, (LLMInfo & { hasCredentials?: boolean; modelKey: string })[]> = {}

    aiStore.getModelsWithCredentials.forEach(model => {
        if (!providers[model.provider]) {
            providers[model.provider] = []
        }
        providers[model.provider]!.push(model)
    })

    return providers
})

// Get provider display names
const getProviderDisplayName = (provider: string) => {
    const names: Record<string, string> = {
        'openai': 'OpenAI',
        'anthropic': 'Anthropic',
        'google': 'Google',
        'azure': 'Azure OpenAI',
        'openrouter': 'OpenRouter',
        'deepseek': 'DeepSeek',
        'xai': 'xAI'
    }
    return names[provider] || provider.charAt(0).toUpperCase() + provider.slice(1)
}

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

// Handle retry
const handleRetry = (modelKey?: string) => {
    emit('retry', modelKey)
}

// Get current model info
const currentModelInfo = computed(() => {
    if (!props.currentModel) return null
    const modelInfo = aiStore.llms[props.currentModel]
    if (!modelInfo) {
        // Fallback for hydration issues - use the model ID as name
        return {
            id: props.currentModel,
            name: props.currentModel,
            provider: 'unknown'
        }
    }
    return modelInfo
})
</script>

<template>
    <TooltipProvider>
        <DropdownMenu>
            <DropdownMenuTrigger>
                <Tooltip>
                    <TooltipTrigger as-child>
                        <Button variant="ghost" size="icon" class="size-8 cursor-pointer relative" :disabled="disabled">
                            <Icon name="lucide:refresh-ccw" class="size-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                        {{ t('retry') }}
                    </TooltipContent>
                </Tooltip>
            </DropdownMenuTrigger>
            <DropdownMenuContent class="w-64" align="end">
                <DropdownMenuLabel>{{ t('retry_message') }}</DropdownMenuLabel>                <!-- Same model retry -->
                <DropdownMenuGroup v-if="currentModelInfo">
                    <DropdownMenuItem class="gap-3" @click="handleRetry(props.currentModel)">
                        <Icon :name="getProviderIcon(currentModelInfo.provider)" class="size-4 flex-shrink-0" />
                        <div class="flex flex-col items-start min-w-0 flex-1">
                            <span class="font-medium truncate">{{ currentModelInfo.name }}</span>
                            <span class="text-xs text-muted-foreground">{{ t('retry_with_same_model') }}</span>
                        </div>
                        <Icon name="lucide:rotate-ccw" class="size-4 flex-shrink-0" />
                    </DropdownMenuItem>
                </DropdownMenuGroup>

                <DropdownMenuSeparator />

                <!-- Different models grouped by provider -->
                <DropdownMenuGroup>
                    <DropdownMenuLabel class="text-xs text-muted-foreground">
                        {{ t('retry_with_different_model') }}
                    </DropdownMenuLabel>

                    <template v-for="(models, provider) in modelsByProvider" :key="provider">
                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger class="gap-3">
                                <Icon :name="getProviderIcon(provider)" class="size-4 flex-shrink-0" />
                                <span>{{ getProviderDisplayName(provider) }}</span>
                            </DropdownMenuSubTrigger>
                            <DropdownMenuPortal>
                                <DropdownMenuSubContent class="w-64">
                                    <DropdownMenuItem
                                        v-for="model in models" :key="model.modelKey"
                                        class="gap-3" :disabled="model.modelKey === props.currentModel || !model.hasCredentials"
                                        @click="handleRetry(model.modelKey)">
                                        <Icon :name="getProviderIcon(model.provider)" class="size-4 flex-shrink-0" />
                                        <div class="flex flex-col items-start min-w-0 flex-1">
                                            <div class="flex items-center gap-2 w-full">
                                                <span class="font-medium truncate">{{ model.name }}</span>
                                                <Badge
                                                    v-if="aiStore.favoriteModels.includes(model.modelKey)"
                                                    variant="secondary" class="text-xs px-1 py-0">
                                                    <Icon name="lucide:star" class="size-3" />
                                                </Badge>
                                            </div>
                                            <span class="text-xs text-muted-foreground">{{ model.developer
                                                }}</span>
                                        </div>
                                        <Icon
                                            v-if="!model.hasCredentials" name="lucide:key"
                                            class="!size-4 text-destructive" />
                                        <Icon
                                            v-if="model.modelKey === props.currentModel" name="lucide:check"
                                            class="size-4 flex-shrink-0" />
                                    </DropdownMenuItem>
                                </DropdownMenuSubContent>
                            </DropdownMenuPortal>
                        </DropdownMenuSub>
                    </template>
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    </TooltipProvider>
</template>
