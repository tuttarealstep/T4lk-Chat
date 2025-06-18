<script setup lang="ts">
import { onMounted } from 'vue'
import { toast } from 'vue-sonner'
import { useUserStore } from '~/stores/user'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { TagsInput, TagsInputInput, TagsInputItem, TagsInputItemDelete, TagsInputItemText } from '@/components/ui/tags-input'

const { t } = useI18n()
const userStore = useUserStore()

definePageMeta({
    middleware: ['auth'],
    layout: 'settings'
})

useSeoMeta({
    title: t('settings_pages.customization.title'),
    description: t('settings_pages.customization.description')
})

const suggestedTraits = computed(() => {
    const defaults = [
        t('traits.friendly'), t('traits.professional'), t('traits.empathetic'),
        t('traits.analytical'), t('traits.creative'), t('traits.optimistic'),
        t('traits.detail_oriented'), t('traits.adaptable'), t('traits.curious'),
        t('traits.supportive'), t('traits.respectful'), t('traits.patient'),
        t('traits.enthusiastic'), t('traits.resourceful'), t('traits.collaborative')
    ]

    return defaults.filter(trait => !userStore.preferences.selectedTraits.includes(trait))
})

const addTrait = (trait: string) => {
    userStore.addTrait(trait)
}

onMounted(() => {
    // Force refresh preferences when entering settings page
    // This ensures we have the latest data if user switched between tabs
    userStore.loadPreferences(true)
})

const handleSave = async () => {
    try {
        await userStore.savePreferences()
        toast.success(t('settings_pages.customization.success_message'))
    } catch (error) {
        toast.error(t('settings_pages.customization.error_message'))
    }
}
</script>

<template>
    <div class="mb-8">
        <h1 class="text-3xl font-bold mb-2">{{ t('settings_pages.customization.title') }}</h1>
        <p class="text-gray-600 dark:text-gray-400">
            {{ t('settings_pages.customization.description') }}
        </p>
    </div>

    <form class="space-y-6" @submit.prevent="handleSave">
        <Card>
            <CardHeader>
                <CardTitle>{{ t('settings_pages.customization.name_title') }}</CardTitle>
            </CardHeader>
            <CardContent class="space-y-4">
                <div class="space-y-2">
                    <Input
v-model="userStore.preferences.name" maxlength="50"
                        :placeholder="t('settings_pages.customization.name_placeholder')" class="w-full" />
                    <div class="flex justify-between text-xs text-muted-foreground">
                        <span />
                        <span>{{ userStore.preferences.name?.length || 0 }}/50</span>
                    </div>
                </div>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>{{ t('settings_pages.customization.occupation_title') }}</CardTitle>
            </CardHeader>
            <CardContent class="space-y-4">
                <div class="space-y-2">
                    <Input
v-model="userStore.preferences.occupation" maxlength="100"
                        :placeholder="t('settings_pages.customization.occupation_placeholder')" class="w-full" />
                    <div class="flex justify-between text-xs text-muted-foreground">
                        <span />
                        <span>{{ userStore.preferences.occupation?.length || 0 }}/100</span>
                    </div>
                </div>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>{{ t('settings_pages.customization.traits_title') }} <span
                        class="text-sm font-normal text-muted-foreground">{{
                            t('settings_pages.customization.traits_subtitle') }}</span></CardTitle>
            </CardHeader>
            <CardContent class="space-y-4">
                <div class="space-y-2">
                    <TagsInput
:model-value="[...userStore.preferences.selectedTraits]" class="w-full"
                        @update:model-value="(value) => userStore.setTraits(value as string[])">

                        <TagsInputItem v-for="item in userStore.preferences.selectedTraits" :key="item" :value="item">
                            <TagsInputItemText />
                            <TagsInputItemDelete />
                        </TagsInputItem>
                        <TagsInputInput :placeholder="t('settings_pages.customization.traits_placeholder')" />
                    </TagsInput>

                    <!-- Suggested traits -->
                    <div class="flex flex-wrap gap-2 mt-3">
                        <Badge
v-for="trait in suggestedTraits" :key="trait" variant="secondary" class="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors
                            rounded-md" @click="addTrait(trait)">
                            + {{ trait }}
                        </Badge>
                    </div>

                    <div class="flex justify-between text-xs text-muted-foreground">
                        <span />
                        <span>{{ userStore.preferences.selectedTraits?.length || 0 }}/50</span>
                    </div>
                </div>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>{{ t('settings_pages.customization.additional_info_title') }}</CardTitle>
            </CardHeader>
            <CardContent class="space-y-4">
                <div class="space-y-2">
                    <Textarea
v-model="userStore.preferences.additionalInfo" maxlength="3000" rows="4"
                        :placeholder="t('settings_pages.customization.additional_info_placeholder')"
                        class="w-full resize-none" />
                    <div class="flex justify-between text-xs text-muted-foreground">
                        <span />
                        <span>{{ userStore.preferences.additionalInfo?.length || 0 }}/3000</span>
                    </div>
                </div>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>{{ t('settings_pages.customization.display_options_title') }}</CardTitle>
            </CardHeader>
            <CardContent class="space-y-4">
                <div class="flex items-center justify-between">
                    <div class="space-y-0.5">
                        <div class="font-medium">{{ t('settings_pages.customization.stats_for_nerds_title') }}</div>
                        <div class="text-sm text-muted-foreground">
                            {{ t('settings_pages.customization.stats_for_nerds_description') }}
                        </div>
                    </div>
                    <Switch
v-model="userStore.preferences.statsForNerds"
                        :aria-label="t('settings_pages.customization.stats_for_nerds_title')" />
                </div>
            </CardContent>
        </Card>

        <div class="flex items-center pt-4">
            <Button type="submit" :disabled="userStore.isSavingPreferences" class="ml-auto">
                <Icon v-if="userStore.isSavingPreferences" name="lucide:loader" class="animate-spin mr-2" />
                <Icon v-else name="lucide:save" class="mr-2" />
                <span>
                    {{ userStore.isSavingPreferences ? t('settings_pages.customization.saving_button') :
                        t('settings_pages.customization.save_button') }}
                </span>
            </Button>
        </div>
    </form>
</template>