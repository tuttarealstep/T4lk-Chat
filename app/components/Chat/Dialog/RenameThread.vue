<script setup lang="ts">
import { ref, computed } from 'vue'
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
import { Input } from '@/components/ui/input'

interface Props {
  threadTitle: string
  open?: boolean
  maxLength?: number
}

interface Emits {
  (e: 'update:open', value: boolean): void
  (e: 'confirm', newTitle: string): void
}

const props = withDefaults(defineProps<Props>(), {
  open: false,
  maxLength: 300
})

const emit = defineEmits<Emits>()

const { t } = useI18n()

const newTitle = ref('')

// Validation computed properties
const trimmedTitle = computed(() => newTitle.value.trim())
const isValidLength = computed(() => trimmedTitle.value.length <= props.maxLength)
const isChanged = computed(() => trimmedTitle.value !== props.threadTitle)
const isValid = computed(() => 
  trimmedTitle.value.length > 0 && 
  isValidLength.value && 
  isChanged.value
)
const remainingChars = computed(() => props.maxLength - newTitle.value.length)

// Caratteri scritti
const writtenChars = computed(() => newTitle.value.length)

// Error message
const errorMessage = computed(() => {
  if (newTitle.value.length === 0) return ''
  if (!isValidLength.value) return t('title_too_long', { max: props.maxLength })
  if (!isChanged.value) return t('title_unchanged')
  return ''
})

watch(() => props.open, (value) => {    
    if (value && props.threadTitle) {
      newTitle.value = props.threadTitle
    }
}, { immediate: true })

const isOpen = computed({
  get: () => props.open,
  set: (value) => {
    emit('update:open', value)
  }
})

const handleConfirm = () => {
  if (isValid.value) {
    emit('confirm', trimmedTitle.value)
    isOpen.value = false
  }
}

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && isValid.value) {
    handleConfirm()
  }
}
</script>

<template>
  <AlertDialog v-model:open="isOpen">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ $t('rename') }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ $t('enter_new_thread_title') }}
        </AlertDialogDescription>
      </AlertDialogHeader>      <div class="py-4 space-y-2">
        <Input
          v-model="newTitle" 
          :placeholder="$t('enter_new_thread_title')"
          :class="[
            'w-full',
            !isValidLength && newTitle.length > 0 ? 'border-destructive focus-visible:ring-destructive' : ''
          ]"
          :maxlength="maxLength"
          @keydown="handleKeyDown"
        />
        <div class="flex justify-between items-center text-sm">
          <div class="text-destructive min-h-[1.25rem]">
            {{ errorMessage }}
          </div>          <div
:class="[
            'text-xs',
            writtenChars > props.maxLength - 20 ? 'text-destructive' : 'text-muted-foreground'
          ]">
            {{ writtenChars }}/{{ maxLength }}
          </div>
        </div>
      </div>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ $t('cancel') }}</AlertDialogCancel>        <AlertDialogAction 
          :disabled="!isValid"
          @click="handleConfirm"
        >
          {{ $t('rename') }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
