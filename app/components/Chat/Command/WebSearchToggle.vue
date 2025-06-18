<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import type { LLM_PROVIDERS } from '#shared/ai/LLM'
import { useI18n } from 'vue-i18n'

interface Props {
    modelValue?: boolean
    provider: LLM_PROVIDERS
    developer?: string
    supportsWebSearch: boolean
}

interface Emits {
    'update:modelValue': [value: boolean]
}

const props = withDefaults(defineProps<Props>(), {
    modelValue: false,
    developer: 'Unknown'
})

const emit = defineEmits<Emits>()

const { t } = useI18n()

const toggleWebSearch = () => {
    if (props.supportsWebSearch) {
        emit('update:modelValue', !props.modelValue)
    }
}

const webSearchTooltip = computed(() => {
    if (!props.supportsWebSearch) {
        return t('chat.web_search_not_supported')
    }
    return props.modelValue ? t('chat.web_search_enabled') : t('chat.web_search_disabled')
})
</script>

<template>
    <TooltipProvider>
        <Tooltip>
            <TooltipTrigger as-child>
                <Button variant="ghost" type="button" size="icon" class="h-8 w-8 cursor-pointer" :class="{
                    'text-primary bg-primary/10': modelValue && props.supportsWebSearch,
                    'text-muted-foreground': !modelValue || !props.supportsWebSearch,
                    'opacity-50 cursor-not-allowed': !props.supportsWebSearch
                }" :disabled="!props.supportsWebSearch" @click="toggleWebSearch">
                    <Icon name="lucide:globe" class="!size-4" />
                </Button>
            </TooltipTrigger>
            <TooltipContent>
                {{ webSearchTooltip }}
            </TooltipContent>
        </Tooltip>
    </TooltipProvider>
</template>
