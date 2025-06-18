<script setup lang="ts">
import type { ApiKeys } from '#shared/types/api-keys'
import { toast } from 'vue-sonner'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useUserStore } from '~/stores/user'
import { useAiStore } from '~/stores/ai'


const { t } = useI18n()
const userStore = useUserStore()
const aiStore = useAiStore()

definePageMeta({
    middleware: ['auth'],
    layout: 'settings'
})

useSeoMeta({
    title: t('settings_pages.api_keys.title'),
    description: t('settings_pages.api_keys.description')
})

// Form reactive data
const formData = ref<ApiKeys>({
    openai: '',
    azure: {
        apiKey: '',
        deployments: {}
    },
    anthropic: '',
    openrouter: '',
    google: '',
    deepseek: '',
    xai: ''
})

// Success message state
const saving = ref(false)

// Azure deployment management
const newAzureDeployment = ref({
    modelId: '',
    resourceName: '',
    deploymentName: ''
})

// Load existing keys on mount
onMounted(() => {
    const existingKeys = userStore.apiKeys
    if (existingKeys) {
        formData.value = {
            openai: existingKeys.openai || '',
            azure: existingKeys.azure || { apiKey: '', deployments: {} },
            anthropic: existingKeys.anthropic || '',
            openrouter: existingKeys.openrouter || '',
            google: existingKeys.google || '',
            deepseek: existingKeys.deepseek || '',
            xai: existingKeys.xai || ''
        }
    }
})

const addAzureDeployment = () => {
    if (!newAzureDeployment.value.modelId || !newAzureDeployment.value.resourceName) {
        return
    }

    if (!formData.value.azure) {
        formData.value.azure = { apiKey: '', deployments: {} }
    }

    if (!formData.value.azure.deployments) {
        formData.value.azure.deployments = {}
    }

    formData.value.azure.deployments[newAzureDeployment.value.modelId] = {
        resourceName: newAzureDeployment.value.resourceName,
        deploymentName: newAzureDeployment.value.deploymentName || undefined
    }

    // Reset form
    newAzureDeployment.value = {
        modelId: '',
        resourceName: '',
        deploymentName: ''
    }
}

const removeAzureDeployment = (modelId: string) => {
    if (formData.value.azure?.deployments) {
        delete formData.value.azure.deployments[modelId]
    }
}

const saveKeys = async () => {
    saving.value = true
    try {
        // Rimuovi campi vuoti prima di salvare
        const keysToSave: ApiKeys = {}

        if (formData.value.openai?.trim()) {
            keysToSave.openai = formData.value.openai.trim()
        }

        if (formData.value.azure?.apiKey?.trim()) {
            keysToSave.azure = {
                apiKey: formData.value.azure.apiKey.trim(),
                deployments: formData.value.azure.deployments || {}
            }
        }

        if (formData.value.anthropic?.trim()) {
            keysToSave.anthropic = formData.value.anthropic.trim()
        }

        if (formData.value.openrouter?.trim()) {
            keysToSave.openrouter = formData.value.openrouter.trim()
        }

        if (formData.value.google?.trim()) {
            keysToSave.google = formData.value.google.trim()
        }

        if (formData.value.deepseek?.trim()) {
            keysToSave.deepseek = formData.value.deepseek.trim()
        } if (formData.value.xai?.trim()) {
            keysToSave.xai = formData.value.xai.trim()
        } userStore.saveApiKeys(keysToSave)

        // Trigger a storage event to notify other tabs/components
        if (import.meta.client) {
            window.dispatchEvent(new StorageEvent('storage', {
                key: 'userApiKeys',
                newValue: JSON.stringify(keysToSave),
                storageArea: localStorage
            }))
        }        // Force refresh of server config and model availability
        await userStore.loadServerConfig(true)

        // Force refresh of AI store model availability
        aiStore.refreshModelAvailability()

        toast.success(t('settings_pages.api_keys.success_message'))
    } catch (error) {
        toast.error(t('settings_pages.api_keys.error_message'))
    } finally {
        saving.value = false
    }
}

const clearAll = () => {
    try {
        userStore.clearApiKeys()
        formData.value = {
            openai: '',
            azure: { apiKey: '', deployments: {} },
            anthropic: '',
            openrouter: '',
            google: '',
            deepseek: '',
            xai: ''
        }

        // Force refresh of model availability after clearing
        aiStore.refreshModelAvailability()

        toast.success(t('settings_pages.api_keys.clear_success_message'))
    } catch {
        toast.error(t('settings_pages.api_keys.clear_error_message'))
    }
}
</script>

<template>
    <div class="mb-8">
        <h1 class="text-3xl font-bold mb-2">{{ t('settings_pages.api_keys.title') }}</h1>
        <p class="text-gray-600 dark:text-gray-400">
            {{ t('settings_pages.api_keys.description') }}
        </p>
    </div>

    <div class="grid gap-6">
        <!-- OpenRouter -->
        <Card>
            <CardHeader>
                <div class="flex items-center justify-between">
                    <CardTitle>OpenRouter</CardTitle>
                    <Badge v-show="userStore.hasApiKey('openrouter')" variant="secondary">{{
                        t('settings_pages.api_keys.configured_badge') }}</Badge>
                </div>
            </CardHeader>
            <CardContent class="space-y-4">
                <div>
                    <label class="block text-sm font-medium mb-2">{{ t('settings_pages.api_keys.api_key_label')
                    }}</label>
                    <Input v-model="formData.openrouter" type="password" autocomplete="off" placeholder="sk-or-..." />
                </div>
            </CardContent>
        </Card>

        <!-- OpenAI -->
        <Card>
            <CardHeader>
                <div class="flex items-center justify-between">
                    <CardTitle>OpenAI</CardTitle>
                    <Badge v-show="userStore.hasApiKey('openai')" variant="secondary">{{
                        t('settings_pages.api_keys.configured_badge') }}</Badge>
                </div>
            </CardHeader>
            <CardContent class="space-y-4">
                <div>
                    <label class="block text-sm font-medium mb-2">{{ t('settings_pages.api_keys.api_key_label')
                    }}</label>
                    <Input v-model="formData.openai" type="password" autocomplete="off" placeholder="sk-..." />
                </div>
            </CardContent>
        </Card>

        <!-- Anthropic -->
        <Card>
            <CardHeader>
                <div class="flex items-center justify-between">
                    <CardTitle>Anthropic</CardTitle>
                    <Badge v-show="userStore.hasApiKey('anthropic')" variant="secondary">{{
                        t('settings_pages.api_keys.configured_badge') }}</Badge>
                </div>
            </CardHeader>
            <CardContent class="space-y-4">
                <div>
                    <label class="block text-sm font-medium mb-2">{{ t('settings_pages.api_keys.api_key_label')
                    }}</label>
                    <Input v-model="formData.anthropic" type="password" autocomplete="off" placeholder="sk-ant-..." />
                </div>
            </CardContent>
        </Card>

        <!-- Google -->
        <Card>
            <CardHeader>
                <div class="flex items-center justify-between">
                    <CardTitle>Google AI</CardTitle>
                    <Badge v-show="userStore.hasApiKey('google')" variant="secondary">{{
                        t('settings_pages.api_keys.configured_badge') }}</Badge>
                </div>
            </CardHeader>
            <CardContent class="space-y-4">
                <div>
                    <label class="block text-sm font-medium mb-2">{{ t('settings_pages.api_keys.api_key_label')
                    }}</label>
                    <Input v-model="formData.google" type="password" autocomplete="off" placeholder="AIza..." />
                </div>
            </CardContent>
        </Card>

        <!-- DeepSeek -->
        <Card>
            <CardHeader>
                <div class="flex items-center justify-between">
                    <CardTitle>DeepSeek</CardTitle>
                    <Badge v-show="userStore.hasApiKey('deepseek')" variant="secondary">{{
                        t('settings_pages.api_keys.configured_badge') }}</Badge>
                </div>
            </CardHeader>
            <CardContent class="space-y-4">
                <div>
                    <label class="block text-sm font-medium mb-2">{{ t('settings_pages.api_keys.api_key_label')
                    }}</label>
                    <Input v-model="formData.deepseek" type="password" autocomplete="off" placeholder="sk-..." />
                </div>
            </CardContent>
        </Card>

        <!-- xAI -->
        <Card>
            <CardHeader>
                <div class="flex items-center justify-between">
                    <CardTitle>xAI</CardTitle>
                    <Badge v-show="userStore.hasApiKey('xai')" variant="secondary">{{
                        t('settings_pages.api_keys.configured_badge') }}</Badge>
                </div>
            </CardHeader>
            <CardContent class="space-y-4">
                <div>
                    <label class="block text-sm font-medium mb-2">{{ t('settings_pages.api_keys.api_key_label')
                    }}</label>
                    <Input v-model="formData.xai" type="password" autocomplete="off" placeholder="xai-..." />
                </div>
            </CardContent>
        </Card>
    </div>
    <!-- Actions -->
    <div class="flex gap-4 mt-8 justify-between">
        <Button variant="destructive" @click="clearAll">
            <Icon name="lucide:trash-2" class="mr-2" />
            {{ t('settings_pages.api_keys.clear_all_button') }}
        </Button>
        <Button :disabled="saving" @click="saveKeys">
            <Icon v-if="saving" name="lucide:loader" class="animate-spin mr-2" />
            <Icon v-else name="lucide:save" class="mr-2" />
            {{ saving ? t('settings_pages.api_keys.saving_button') : t('settings_pages.api_keys.save_button') }}
        </Button>
    </div>

    <!-- Warning -->
    <div class="mt-8 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <div class="flex items-start">
            <svg class="w-5 h-5 text-yellow-500 mr-3 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clip-rule="evenodd" />
            </svg>
            <div>
                <h3 class="text-sm font-medium text-yellow-800 dark:text-yellow-200">{{
                    t('settings_pages.api_keys.security_notice_title') }}</h3>
                <p class="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    {{ t('settings_pages.api_keys.security_notice_description') }}
                </p>
            </div>
        </div>
    </div>
</template>
