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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

interface Props {
  threadTitle: string
  open?: boolean
}

interface Emits {
  (e: 'update:open', value: boolean): void
  (e: 'confirm'): void
}

const props = withDefaults(defineProps<Props>(), {
  open: false
})

const emit = defineEmits<Emits>()

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
})

const handleConfirm = () => {
  emit('confirm')
  isOpen.value = false
}
</script>

<template>
  <AlertDialog v-model:open="isOpen">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ $t('confirm_delete_thread') }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ $t('confirm_delete_thread_description') }}
          <br><br>
          <strong>"{{ threadTitle }}"</strong>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ $t('cancel') }}</AlertDialogCancel>
        <AlertDialogAction class="bg-destructive hover:bg-destructive/90" @click="handleConfirm">
          {{ $t('delete') }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>