<script setup lang="ts">
import { ref, computed } from 'vue'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { useUserStore } from '~/stores/user'
import { toast } from 'vue-sonner'

const { t } = useI18n()
const userStore = useUserStore()

const isOpen = ref(false)
const tempApiKeys = ref<Record<string, any>>(userStore.apiKeys || {})

// Provider configurations with icons and descriptions
const providers = [
    {
        id: 'openrouter',
        name: 'OpenRouter',
        icon: 'lucide:route',
        description: t('api_keys.openrouter_description'),
        placeholder: 'sk-or-...',
        hasServerKey: computed(() => userStore.serverConfig?.openrouter || false)
    },
    {
        id: 'openai',
        name: 'OpenAI',
        icon: 'simple-icons:openai',
        description: t('api_keys.openai_description'),
        placeholder: 'sk-...',
        hasServerKey: computed(() => userStore.serverConfig?.openai || false)
    },
    {
        id: 'anthropic',
        name: 'Anthropic',
        icon: 'simple-icons:anthropic',
        description: t('api_keys.anthropic_description'),
        placeholder: 'sk-ant-...',
        hasServerKey: computed(() => userStore.serverConfig?.anthropic || false)
    },
    {
        id: 'google',
        name: 'Google',
        icon: 'simple-icons:google',
        description: t('api_keys.google_description'),
        placeholder: 'AIza...',
        hasServerKey: computed(() => userStore.serverConfig?.google || false)
    },
    {
        id: 'deepseek',
        name: 'DeepSeek',
        icon: 'lucide:search',
        description: t('api_keys.deepseek_description'),
        placeholder: 'sk-...',
        hasServerKey: computed(() => userStore.serverConfig?.deepseek || false)
    },
    {
        id: 'xai',
        name: 'xAI',
        icon: 'lucide:x',
        description: t('api_keys.xai_description'),
        placeholder: 'xai-...',
        hasServerKey: computed(() => userStore.serverConfig?.xai || false)
    }
]

const handleSaveApiKeys = () => {
    try {
        // Remove empty values
        const cleanedKeys = Object.fromEntries(
            Object.entries(tempApiKeys.value).filter(([key, value]) => {
                if (typeof value === 'string') {
                    return value.trim() !== ''
                }
                return value !== null && value !== undefined
            })
        )

        userStore.saveApiKeys(cleanedKeys)
        isOpen.value = false
        toast.success(t('api_keys.saved_successfully'))

        // Trigger a refresh of models
        window.dispatchEvent(new StorageEvent('storage', {
            key: 'userApiKeys',
            newValue: JSON.stringify(cleanedKeys)
        }))
    } catch (error) {
        toast.error(t('api_keys.save_failed'))
    }
}

const handleCancel = () => {
    tempApiKeys.value = userStore.apiKeys || {}
    isOpen.value = false
}

// Check if user has any API keys configured
const hasUserApiKeys = computed(() => {
    const keys = tempApiKeys.value
    return Object.values(keys).some(value => {
        if (typeof value === 'string') return value.trim() !== ''
        return value !== null && value !== undefined
    })
})
</script>

<template>
    <Dialog v-model:open="isOpen">
        <DialogTrigger as-child>
            <Button variant="outline" size="sm" class="text-xs">
                <Icon name="lucide:key" class="!size-3 mr-1" />
                {{ t('api_keys.setup_keys') }}
            </Button>
        </DialogTrigger>
        <DialogContent class="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle class="flex items-center gap-2">
                    <Icon name="lucide:key" class="!size-5" />
                    {{ t('api_keys.title') }}
                </DialogTitle>
                <DialogDescription>
                    {{ t('api_keys.description') }}
                </DialogDescription>
            </DialogHeader>

            <div class="space-y-4">
                <!-- Security Notice -->
                <Card class="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
                    <CardContent class="pt-4">
                        <div class="flex items-start gap-2">
                            <div class="text-sm text-amber-800 dark:text-amber-200">
                                <Icon name="lucide:shield-check" class="!size-4 text-amber-600 mt-0.5" /> {{
                                    t('api_keys.security_notice') }}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <!-- API Keys Grid -->
                <div class="grid gap-4">
                    <div v-for="provider in providers" :key="provider.id" class="space-y-2">
                        <Card class="relative">
                            <CardHeader class="pb-3">
                                <div class="flex items-center justify-between">
                                    <div class="flex items-center gap-2">
                                        <Icon :name="provider.icon" class="!size-5" />
                                        <CardTitle class="text-sm">{{ provider.name }}</CardTitle>
                                    </div>
                                    <Badge v-if="provider.hasServerKey.value" variant="secondary" class="text-xs">
                                        {{ t('api_keys.server_configured') }}
                                    </Badge>
                                </div>
                                <CardDescription class="text-xs">
                                    {{ provider.description }}
                                </CardDescription>
                            </CardHeader>
                            <CardContent class="pt-0">
                                <div class="space-y-2">
                                    <label :for="provider.id" class="text-xs font-medium">
                                        {{ t('api_keys.api_key_label') }}
                                    </label>
                                    <Input :id="provider.id" v-model="tempApiKeys[provider.id]" type="password"
                                        :placeholder="provider.placeholder" class="text-xs font-mono"
                                        :disabled="provider.hasServerKey.value" />
                                    <p v-if="provider.hasServerKey.value" class="text-xs text-muted-foreground">
                                        {{ t('api_keys.server_key_configured') }}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <Separator />

                <!-- Action Buttons -->
                <div class="flex justify-between items-center">
                    <div class="text-xs text-muted-foreground">
                        {{ hasUserApiKeys ? t('api_keys.keys_configured') : t('api_keys.no_keys_configured') }}
                    </div>
                    <div class="flex gap-2">
                        <Button variant="outline" size="sm" @click="handleCancel">
                            {{ t('common.cancel') }}
                        </Button>
                        <Button size="sm" @click="handleSaveApiKeys">
                            <Icon name="lucide:save" class="!size-3 mr-1" />
                            {{ t('api_keys.save') }}
                        </Button>
                    </div>
                </div>
            </div>
        </DialogContent>
    </Dialog>
</template>
