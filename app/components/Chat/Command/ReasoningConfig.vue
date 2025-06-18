<script setup lang="ts">
import { LLM_PROVIDERS } from '#shared/ai/LLM'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
    openai?: {
      reasoningEffort?: 'low' | 'medium' | 'high'
    }
    anthropic?: {
      thinking?: {
        type?: 'enabled'
        budgetTokens?: number
      }
    }
    google?: {
      includeThoughts?: boolean
      thinkingBudget?: number
    }
    openrouter?: {
      reasoning?: {
        max_tokens?: number
        effort?: 'low' | 'medium' | 'high'
      }
    }
  }
}

interface Emits {
  (e: 'update:modelValue', value: Props['modelValue']): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => ({})
})

const emit = defineEmits<Emits>()

const { t } = useI18n()

const isOpen = ref(false)

// Funzioni di update dirette che emettono immediatamente
const updateOpenAI = (effort: 'low' | 'medium' | 'high') => {
  emit('update:modelValue', {
    ...props.modelValue,
    openai: { reasoningEffort: effort }
  })
}

const updateAnthropicToggle = (enabled: boolean) => {
  if (enabled) {
    // Quando abilitiamo, impostiamo subito il valore di default
    emit('update:modelValue', {
      ...props.modelValue,
      anthropic: {
        thinking: {
          type: 'enabled',
          budgetTokens: props.modelValue?.anthropic?.thinking?.budgetTokens || 12000
        }
      }
    })
  } else {
    // Quando disabilitiamo, rimuoviamo tutto
    const newValue = { ...props.modelValue }
    if (newValue.anthropic) {
      delete newValue.anthropic.thinking
      if (Object.keys(newValue.anthropic).length === 0) {
        delete newValue.anthropic
      }
    }
    emit('update:modelValue', newValue)
  }
}

const updateAnthropicTokens = (budgetTokens: number) => {
  emit('update:modelValue', {
    ...props.modelValue,
    anthropic: {
      thinking: {
        type: 'enabled',
        budgetTokens
      }
    }
  })
}

const updateGoogle = (field: 'includeThoughts' | 'thinkingBudget', value: boolean | number) => {
  emit('update:modelValue', {
    ...props.modelValue,
    google: {
      ...props.modelValue?.google,
      [field]: value
    }
  })
}

const updateOpenRouterEffort = (effort: 'low' | 'medium' | 'high') => {
  emit('update:modelValue', {
    ...props.modelValue,
    openrouter: {
      reasoning: {
        ...props.modelValue?.openrouter?.reasoning,
        effort
      }
    }
  })
}

const updateOpenRouterTokens = (max_tokens: number) => {
  emit('update:modelValue', {
    ...props.modelValue,
    openrouter: {
      reasoning: {
        ...props.modelValue?.openrouter?.reasoning,
        max_tokens
      }
    }
  })
}

const resetConfig = () => {
  emit('update:modelValue', {})
}

// Computed properties che leggono direttamente dalle props
const hasConfig = computed(() => {
  if (!props.modelValue) return false
  return Object.keys(props.modelValue).some(key => {
    const providerConfig = props.modelValue![key as keyof typeof props.modelValue]
    return providerConfig && Object.keys(providerConfig).length > 0
  })
})

const displayText = computed(() => {
  const config = props.modelValue

  if (!config) return t('chat.effort_no_thinking')

  switch (props.provider) {
    case LLM_PROVIDERS.OPENAI:
      if (config.openai?.reasoningEffort) {
        return t(`chat.effort_${config.openai.reasoningEffort}`)
      }
      break

    case LLM_PROVIDERS.ANTHROPIC:
      if (config.anthropic?.thinking?.type === 'enabled') {
        const budget = config.anthropic.thinking.budgetTokens
        return budget ? t('chat.thinking_configured', { budget }) : t('chat.thinking_enabled')
      }
      break

    case LLM_PROVIDERS.GOOGLE:
      if (config.google) {
        const { includeThoughts, thinkingBudget } = config.google
        if (includeThoughts === false) {
          return t('chat.effort_no_thinking')
        }
        if (thinkingBudget && thinkingBudget !== 2048) {
          return t('chat.thinking_configured', { budget: thinkingBudget })
        }
        // Se include thoughts è true ma budget è default, mostra configurato
        if (includeThoughts === true) {
          return t('chat.thinking_configured', { budget: thinkingBudget || 2048 })
        }
      }
      break

    case LLM_PROVIDERS.OPENROUTER:
      if (config.openrouter?.reasoning) {
        const { effort, max_tokens } = config.openrouter.reasoning
        if (effort && max_tokens) {
          return t('chat.reasoning_tokens', { tokens: max_tokens }) + ` (${t(`chat.effort_${effort}`)})`
        }
        if (effort) {
          return t(`chat.effort_${effort}`)
        }
        if (max_tokens) {
          return t('chat.reasoning_tokens', { tokens: max_tokens })
        }
      }
      break
  }

  return t('chat.effort_no_thinking')
})
</script>

<template>
  <Popover v-model:open="isOpen">
    <PopoverTrigger as-child>
      <Button variant="ghost" size="sm" class="ml-2 relative cursor-pointer"
        :class="{ 'text-primary bg-primary/10': hasConfig, }">
        <Icon name="lucide:brain" class="h-4 w-4 mr-1" />
        {{ displayText }}
        <div v-if="hasConfig" class="absolute -top-1 -right-1 h-2 w-2 bg-primary rounded-full" />
      </Button>
    </PopoverTrigger>

    <PopoverContent class="w-80">
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h4 class="font-medium text-sm">{{ t('chat.reasoning_configuration') }}</h4>
          <Button v-if="hasConfig" variant="ghost" size="sm" class="text-xs h-6 px-2 cursor-pointer"
            @click="resetConfig">
            {{ t('reset') }}
          </Button>
        </div>

        <!-- OpenAI Configuration -->
        <div v-if="provider === LLM_PROVIDERS.OPENAI" class="space-y-3">
          <div class="space-y-2">
            <Label class="text-xs font-medium">{{ t('chat.reasoning_effort') }}</Label>
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button variant="outline" class="w-full justify-between h-8">
                  <div class="flex items-center gap-2">
                    <Icon v-if="modelValue?.openai?.reasoningEffort" :name="modelValue.openai.reasoningEffort === 'low' ? 'lucide:zap' :
                      modelValue.openai.reasoningEffort === 'high' ? 'lucide:cpu' : 'lucide:activity'"
                      class="h-3 w-3" />
                    {{ t(`chat.effort_${modelValue?.openai?.reasoningEffort || 'no_thinking'}`) }}
                  </div>
                  <Icon name="lucide:chevron-down" class="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent class="w-full">
                <DropdownMenuItem @click="updateOpenAI('low')">
                  <div class="flex items-center gap-2">
                    <Icon name="lucide:zap" class="h-3 w-3" />
                    {{ t('chat.effort_low') }}
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem @click="updateOpenAI('medium')">
                  <div class="flex items-center gap-2">
                    <Icon name="lucide:activity" class="h-3 w-3" />
                    {{ t('chat.effort_medium') }}
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem @click="updateOpenAI('high')">
                  <div class="flex items-center gap-2">
                    <Icon name="lucide:cpu" class="h-3 w-3" />
                    {{ t('chat.effort_high') }}
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <p class="text-xs text-muted-foreground">
              {{ t('chat.reasoning_effort_description') }}
            </p>
          </div>
        </div> <!-- Anthropic Configuration -->
        <div v-if="provider === LLM_PROVIDERS.ANTHROPIC" class="space-y-3">
          <div class="flex items-center justify-between">
            <Label class="text-xs font-medium">{{ t('chat.enable_thinking') }}</Label>
            <Switch :model-value="modelValue?.anthropic?.thinking?.type === 'enabled'"
              @update:model-value="updateAnthropicToggle" />
          </div>
          <p class="text-xs text-muted-foreground">
            {{ t('chat.enable_thinking_description') }}
          </p>

          <div v-if="modelValue?.anthropic?.thinking?.type === 'enabled'" class="space-y-2">
            <Label class="text-xs font-medium">{{ t('chat.budget_tokens') }}</Label>
            <Input type="number" min="1000" max="50000" step="1000" class="h-8"
              :model-value="modelValue?.anthropic?.thinking?.budgetTokens || 12000"
              @update:model-value="(value) => updateAnthropicTokens(Number(value))" />
            <p class="text-xs text-muted-foreground">
              {{ t('chat.budget_tokens_description') }}
            </p>
          </div>
        </div>

        <!-- Google Configuration -->
        <div v-if="provider === LLM_PROVIDERS.GOOGLE" class="space-y-3">
          <div class="flex items-center justify-between">
            <Label class="text-xs font-medium">{{ t('chat.include_thoughts') }}</Label>
            <Switch :model-value="modelValue?.google?.includeThoughts ?? false"
              @update:model-value="(value: boolean) => updateGoogle('includeThoughts', value)" />
          </div>
          <p class="text-xs text-muted-foreground">
            {{ t('chat.include_thoughts_description') }}
          </p>

          <div class="space-y-2">
            <Label class="text-xs font-medium">{{ t('chat.thinking_budget') }}</Label>
            <Input type="number" min="512" max="32768" step="512" class="h-8"
              :model-value="modelValue?.google?.thinkingBudget || 2048"
              @update:model-value="(value) => updateGoogle('thinkingBudget', Number(value))" />
            <p class="text-xs text-muted-foreground">
              {{ t('chat.thinking_budget_description') }}
            </p>
          </div>
        </div>

        <!-- OpenRouter Configuration -->
        <div v-if="provider === LLM_PROVIDERS.OPENROUTER" class="space-y-3">
          <!-- Show different configurations based on developer -->
          <div v-if="developer === 'OpenAI' || developer === 'xAI'" class="space-y-3">
            <div class="space-y-2">
              <Label class="text-xs font-medium">{{ t('chat.reasoning_effort') }}</Label>
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button variant="outline" class="w-full justify-between h-8">
                    <div class="flex items-center gap-2">
                      <Icon v-if="modelValue?.openrouter?.reasoning?.effort" :name="modelValue.openrouter.reasoning.effort === 'low' ? 'lucide:zap' :
                        modelValue.openrouter.reasoning.effort === 'high' ? 'lucide:cpu' : 'lucide:activity'"
                        class="h-3 w-3" />
                      {{ t(`chat.effort_${modelValue?.openrouter?.reasoning?.effort || 'no_thinking'}`) }}
                    </div>
                    <Icon name="lucide:chevron-down" class="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent class="w-full">
                  <DropdownMenuItem @click="updateOpenRouterEffort('low')">
                    <div class="flex items-center gap-2">
                      <Icon name="lucide:zap" class="h-3 w-3" />
                      {{ t('chat.effort_low') }}
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem @click="updateOpenRouterEffort('medium')">
                    <div class="flex items-center gap-2">
                      <Icon name="lucide:activity" class="h-3 w-3" />
                      {{ t('chat.effort_medium') }}
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem @click="updateOpenRouterEffort('high')">
                    <div class="flex items-center gap-2">
                      <Icon name="lucide:cpu" class="h-3 w-3" />
                      {{ t('chat.effort_high') }}
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <p class="text-xs text-muted-foreground">
                {{ t('chat.reasoning_effort_description') }}
              </p>
            </div>
          </div>

          <!-- For Anthropic and Google models via OpenRouter -->
          <div v-if="developer === 'Anthropic' || developer === 'Google'" class="space-y-3">
            <div class="space-y-2">
              <Label class="text-xs font-medium">{{ t('chat.max_reasoning_tokens') }}</Label>
              <Input type="number" min="1" max="100000" step="1000" class="h-8"
                :model-value="modelValue?.openrouter?.reasoning?.max_tokens || 10000"
                @update:model-value="(value) => updateOpenRouterTokens(Number(value))" />
              <p class="text-xs text-muted-foreground">
                {{ t('chat.max_reasoning_tokens_description') }}
              </p>
            </div>
          </div> <!-- For other developers or mixed support -->
          <div
            v-if="developer !== 'OpenAI' && developer !== 'xAI' && developer !== 'Anthropic' && developer !== 'Google'"
            class="space-y-3">
            <div class="space-y-2">
              <Label class="text-xs font-medium">{{ t('chat.reasoning_effort') }}</Label>
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button variant="outline" class="w-full justify-between h-8">
                    <div class="flex items-center gap-2">
                      <Icon v-if="modelValue?.openrouter?.reasoning?.effort" :name="modelValue.openrouter.reasoning.effort === 'low' ? 'lucide:zap' :
                        modelValue.openrouter.reasoning.effort === 'high' ? 'lucide:cpu' : 'lucide:activity'"
                        class="h-3 w-3" />
                      {{ t(`chat.effort_${modelValue?.openrouter?.reasoning?.effort || 'no_thinking'}`) }}
                    </div>
                    <Icon name="lucide:chevron-down" class="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent class="w-full">
                  <DropdownMenuItem @click="updateOpenRouterEffort('low')">
                    <div class="flex items-center gap-2">
                      <Icon name="lucide:zap" class="h-3 w-3" />
                      {{ t('chat.effort_low') }}
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem @click="updateOpenRouterEffort('medium')">
                    <div class="flex items-center gap-2">
                      <Icon name="lucide:activity" class="h-3 w-3" />
                      {{ t('chat.effort_medium') }}
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem @click="updateOpenRouterEffort('high')">
                    <div class="flex items-center gap-2">
                      <Icon name="lucide:cpu" class="h-3 w-3" />
                      {{ t('chat.effort_high') }}
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <p class="text-xs text-muted-foreground">
                {{ t('chat.reasoning_effort_description') }}
              </p>
            </div>

            <div class="space-y-2">
              <Label class="text-xs font-medium">{{ t('chat.max_reasoning_tokens') }}</Label>
              <Input type="number" min="1" max="100000" step="1000" class="h-8"
                :model-value="modelValue?.openrouter?.reasoning?.max_tokens || 10000"
                @update:model-value="(value) => updateOpenRouterTokens(Number(value))" />
              <p class="text-xs text-muted-foreground">
                {{ t('chat.max_reasoning_tokens_description') }}
              </p>
            </div>
          </div>
        </div>

        <!-- Other providers -->
        <div
          v-if="provider !== LLM_PROVIDERS.OPENAI && provider !== LLM_PROVIDERS.ANTHROPIC && provider !== LLM_PROVIDERS.GOOGLE && provider !== LLM_PROVIDERS.OPENROUTER"
          class="text-center py-4">
          <p class="text-sm text-muted-foreground">
            {{ t('chat.reasoning_not_supported', { provider }) }}
          </p>
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>