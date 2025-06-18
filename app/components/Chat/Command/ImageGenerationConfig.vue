<script setup lang="ts">
import { LLM_PROVIDERS } from '#shared/ai/LLM'
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

interface Props {
    provider: LLM_PROVIDERS
    developer: string
    modelValue?: {
        n?: number
        size?: '1024x1024' | '1536x1024' | '1024x1536' | 'auto'
        openai?: {
            quality?: 'auto' | 'high' | 'medium' | 'low'
            background?: 'auto' | 'transparent' | 'opaque'
            output_format?: 'png' | 'jpeg' | 'webp'
            output_compression?: number
            moderation?: 'auto' | 'low'
        }
    }
}

interface Emits {
    (e: 'update:modelValue', value: Props['modelValue']): void
}

const props = withDefaults(defineProps<Props>(), {
    modelValue: () => ({
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
})

const emit = defineEmits<Emits>()

const { t } = useI18n()

const isOpen = ref(false)

// Helper function to update values
const updateValue = (path: string[], value: unknown) => {
    const newModelValue = JSON.parse(JSON.stringify(props.modelValue || {}))

    let current: Record<string, unknown> = newModelValue
    for (let i = 0; i < path.length - 1; i++) {
        const key = path[i]
        if (key && !current[key]) {
            current[key] = {}
        }
        if (key && current[key]) {
            current = current[key] as Record<string, unknown>
        }
    }
    const finalKey = path[path.length - 1]
    if (finalKey) {
        current[finalKey] = value
    }

    emit('update:modelValue', newModelValue)
}

// Update functions
const updateN = (n: number) => {
    updateValue(['n'], Math.max(1, Math.min(10, n)))
}

const updateSize = (size: '1024x1024' | '1536x1024' | '1024x1536' | 'auto') => {
    updateValue(['size'], size)
}

const updateOpenAIQuality = (quality: 'auto' | 'high' | 'medium' | 'low') => {
    updateValue(['openai', 'quality'], quality)
}

const updateOpenAIBackground = (background: 'auto' | 'transparent' | 'opaque') => {
    updateValue(['openai', 'background'], background)
}

const updateOpenAIFormat = (format: 'png' | 'jpeg' | 'webp') => {
    updateValue(['openai', 'output_format'], format)
}

const updateOpenAICompression = (compression: number) => {
    updateValue(['openai', 'output_compression'], Math.max(0, Math.min(100, compression)))
}

const updateOpenAIModeration = (moderation: 'auto' | 'low') => {
    updateValue(['openai', 'moderation'], moderation)
}

// Computed properties
const currentN = computed(() => props.modelValue?.n || 1)
const currentSize = computed(() => props.modelValue?.size || '1024x1024')
const currentQuality = computed(() => props.modelValue?.openai?.quality || 'auto')
const currentBackground = computed(() => props.modelValue?.openai?.background || 'auto')
const currentFormat = computed(() => props.modelValue?.openai?.output_format || 'png')
const currentCompression = computed(() => props.modelValue?.openai?.output_compression || 100)
const currentModeration = computed(() => props.modelValue?.openai?.moderation || 'auto')

// Size options
const sizeOptions = [
    { value: '1024x1024', label: '1024×1024 (Square)' },
    { value: '1536x1024', label: '1536×1024 (Landscape)' },
    { value: '1024x1536', label: '1024×1536 (Portrait)' },
    { value: 'auto', label: 'Auto' }
]

// Quality options
const qualityOptions = [
    { value: 'auto', label: 'Auto' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' }
]

// Background options
const backgroundOptions = [
    { value: 'auto', label: 'Auto' },
    { value: 'transparent', label: 'Transparent' },
    { value: 'opaque', label: 'Opaque' }
]

// Format options
const formatOptions = [
    { value: 'png', label: 'PNG' },
    { value: 'jpeg', label: 'JPEG' },
    { value: 'webp', label: 'WebP' }
]

// Moderation options
const moderationOptions = [
    { value: 'auto', label: 'Auto' },
    { value: 'low', label: 'Low' }
]

// Check if compression is relevant (only for webp/jpeg)
const isCompressionRelevant = computed(() => {
    const format = currentFormat.value
    return format === 'webp' || format === 'jpeg'
})

// Show OpenAI specific options only for OpenAI provider
const showOpenAIOptions = computed(() => props.provider === LLM_PROVIDERS.OPENAI)
</script>

<template>
    <Popover v-model:open="isOpen">
        <PopoverTrigger>
            <Button variant="ghost" type="button" size="icon" class="h-8 w-8 cursor-pointer">
                <Icon name="lucide:image" class="h-4 w-4" />
            </Button>
        </PopoverTrigger>
        <PopoverContent class="w-80">
            <div class="space-y-4">
                <div class="space-y-2">
                    <h4 class="font-medium leading-none">{{ t('chat.image_generation_config.title') }}</h4>
                    <p class="text-sm text-muted-foreground">
                        {{ t('chat.image_generation_config.description') }}
                    </p>
                </div>

                <!-- Number of images -->
                <div class="space-y-2">
                    <Label for="image-count">{{ t('chat.image_generation_config.count') }}</Label>
                    <Input id="image-count" type="number" min="1" max="10" class="w-full" :model-value="currentN"
                        @update:model-value="(value) => updateN(Number(value))" />
                    <p class="text-xs text-muted-foreground">
                        {{ t('chat.image_generation_config.count_description') }}
                    </p>
                </div>

                <!-- Image size -->
                <div class="space-y-2">
                    <Label>{{ t('chat.image_generation_config.size') }}</Label>
                    <DropdownMenu>
                        <DropdownMenuTrigger as-child>
                            <Button variant="outline" type="button" class="w-full justify-between cursor-pointer">
                                {{sizeOptions.find(opt => opt.value === currentSize)?.label}}
                                <Icon name="lucide:chevron-down" class="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent class="w-full">
                            <DropdownMenuItem v-for="option in sizeOptions" :key="option.value"
                                @click="updateSize(option.value as any)">
                                {{ option.label }}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <!-- OpenAI specific options -->
                <template v-if="showOpenAIOptions">
                    <div class="border-t pt-3 space-y-4">
                        <h5 class="font-medium text-sm">{{ t('chat.image_generation_config.openai_options') }}</h5>

                        <!-- Quality -->
                        <div class="space-y-2">
                            <Label>{{ t('chat.image_generation_config.quality') }}</Label>
                            <DropdownMenu>
                                <DropdownMenuTrigger as-child>
                                    <Button variant="outline" type="button"
                                        class="w-full justify-between cursor-pointer">
                                        {{qualityOptions.find(opt => opt.value === currentQuality)?.label}}
                                        <Icon name="lucide:chevron-down" class="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent class="w-full">
                                    <DropdownMenuItem v-for="option in qualityOptions" :key="option.value"
                                        @click="updateOpenAIQuality(option.value as any)">
                                        {{ option.label }}
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        <!-- Background -->
                        <div class="space-y-2">
                            <Label>{{ t('chat.image_generation_config.background') }}</Label>
                            <DropdownMenu>
                                <DropdownMenuTrigger as-child>
                                    <Button variant="outline" type="button"
                                        class="w-full justify-between cursor-pointer">
                                        {{backgroundOptions.find(opt => opt.value === currentBackground)?.label}}
                                        <Icon name="lucide:chevron-down" class="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent class="w-full">
                                    <DropdownMenuItem v-for="option in backgroundOptions" :key="option.value"
                                        @click="updateOpenAIBackground(option.value as any)">
                                        {{ option.label }}
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        <!-- Output format -->
                        <div class="space-y-2">
                            <Label>{{ t('chat.image_generation_config.format') }}</Label>
                            <DropdownMenu>
                                <DropdownMenuTrigger as-child>
                                    <Button variant="outline" type="button"
                                        class="w-full justify-between cursor-pointer">
                                        {{formatOptions.find(opt => opt.value === currentFormat)?.label}}
                                        <Icon name="lucide:chevron-down" class="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent class="w-full">
                                    <DropdownMenuItem v-for="option in formatOptions" :key="option.value"
                                        @click="updateOpenAIFormat(option.value as any)">
                                        {{ option.label }}
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        <!-- Compression (only for webp/jpeg) -->
                        <div v-if="isCompressionRelevant" class="space-y-2">
                            <Label for="compression">{{ t('chat.image_generation_config.compression') }}</Label> <Input
                                id="compression" type="number" min="0" max="100" class="w-full"
                                :model-value="currentCompression"
                                @update:model-value="(value) => updateOpenAICompression(Number(value))" />
                            <p class="text-xs text-muted-foreground">
                                {{ t('chat.image_generation_config.compression_description') }}
                            </p>
                        </div>

                        <!-- Moderation -->
                        <div class="space-y-2">
                            <Label>{{ t('chat.image_generation_config.moderation') }}</Label>
                            <DropdownMenu>
                                <DropdownMenuTrigger as-child>
                                    <Button variant="outline" type="button"
                                        class="w-full justify-between cursor-pointer">
                                        {{moderationOptions.find(opt => opt.value === currentModeration)?.label}}
                                        <Icon name="lucide:chevron-down" class="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent class="w-full">
                                    <DropdownMenuItem v-for="option in moderationOptions" :key="option.value"
                                        @click="updateOpenAIModeration(option.value as any)">
                                        {{ option.label }}
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </template>
            </div>
        </PopoverContent>
    </Popover>
</template>
