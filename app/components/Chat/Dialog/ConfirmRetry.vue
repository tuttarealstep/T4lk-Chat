<script setup lang="ts">
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useI18n } from 'vue-i18n'

interface Props {
    open: boolean
    messageCount?: number
}

interface Emits {
    'update:open': [value: boolean]
    'confirm': []
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()
</script>

<template>
    <AlertDialog :open="props.open" @update:open="(value) => emit('update:open', value)">
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>{{ t('retry_message') }}</AlertDialogTitle>
                <AlertDialogDescription>
                    {{ t('confirm_retry_message') }}
                    <br>
                    <span
v-if="props.messageCount && props.messageCount > 0"
                        class="text-xs text-muted-foreground mt-1 block">
                        {{ t('messages_after_will_be_deleted') }} ({{ props.messageCount }} {{ t('messages') }})
                    </span>
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>{{ t('cancel') }}</AlertDialogCancel>
                <AlertDialogAction @click="emit('confirm')">{{ t('confirm_retry') }}</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
</template>
