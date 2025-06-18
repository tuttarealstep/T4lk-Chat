<script setup lang="ts">
import { ref } from 'vue'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import ChatCommandModelSelection from '~/components/Chat/Command/ModelSelection.vue'
import { useI18n } from 'vue-i18n'

interface Props {
    open: boolean
    currentModel?: string
    messageRole: 'user' | 'assistant'
}

interface Emits {
    'update:open': [value: boolean]
    'retry-same': []
    'retry-different': [modelId: string]
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()
const selectedModel = ref<string>('')
const showModelSelection = ref(false)

// Handle same model retry
const handleRetrySame = () => {
    emit('retry-same')
    emit('update:open', false)
}

// Handle different model retry
const handleRetryDifferent = () => {
    showModelSelection.value = true
}

// Handle model selection
const handleModelSelected = (modelKey: string) => {
    selectedModel.value = modelKey
    emit('retry-different', modelKey)
    emit('update:open', false)
    showModelSelection.value = false
}

// Handle close
const handleClose = () => {
    showModelSelection.value = false
}

// Watch for dialog close
watch(() => props.open, (newValue) => {
    if (!newValue) {
        showModelSelection.value = false
        selectedModel.value = ''
    }
})
</script>

<template>
    <Dialog :open="props.open" @update:open="(value) => emit('update:open', value)">
        <DialogContent class="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>{{ t('retry_message') }}</DialogTitle>
                <DialogDescription>
                    {{ t('confirm_retry') }}
                    <br>
                    <span class="text-xs text-muted-foreground mt-1 block">
                        {{ t('messages_after_will_be_deleted') }}
                    </span>
                </DialogDescription>
            </DialogHeader>

            <div v-if="!showModelSelection" class="flex flex-col gap-3">
                <!-- Same model retry -->
                <Button class="justify-start gap-2" variant="outline" @click="handleRetrySame">
                    <Icon name="lucide:rotate-ccw" class="size-4" />
                    {{ t('retry_with_same_model') }}
                    <span v-if="props.currentModel" class="text-xs text-muted-foreground ml-auto">
                        {{ props.currentModel }}
                    </span>
                </Button>

                <Separator />

                <!-- Different model retry -->
                <Button class="justify-start gap-2" variant="outline" @click="handleRetryDifferent">
                    <Icon name="lucide:shuffle" class="size-4" />
                    {{ t('retry_with_different_model') }}
                </Button>
            </div>

            <!-- Model selection -->
            <div v-else class="h-[400px]">
                <ChatCommandModelSelection 
                    mode="full"
                    @model-selected="handleModelSelected"
                    @close="handleClose"
                />
            </div>

            <DialogFooter v-if="!showModelSelection">
                <Button variant="outline" @click="emit('update:open', false)">
                    {{ t('cancel') }}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
