<template>
  <div class="relative mt-2 flex w-full flex-col pt-9">
    <div
      class="absolute inset-x-0 top-0 flex h-10 items-center justify-between rounded-t bg-secondary-foreground px-4 py-2 text-sm text-secondary">
      <span class="font-mono">{{ language }}</span>
      <div class="flex gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="secondary" size="icon" class="size-8 cursor-pointer mr-7" @click="downloadCode">
                <Icon name="lucide:download" class="!size-4" />
                <span class="sr-only">{{ $t('download') }}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {{ $t('download') }}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
    <div class="sticky left-auto z-[1] ml-auto h-1.5 w-8 transition-[top] top-[42px] max-[1170px]:top-20">
      <div class="absolute -top-[calc(2rem)] right-2 flex gap-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="secondary" size="icon" class="size-8 cursor-pointer" @click="copyCode">
                <Icon name="lucide:copy" class="!size-4" />
                <span class="sr-only">{{ $t('copy') }}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {{ $t('copy') }}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
    <div
      class="bg-chat-accent text-sm font-[450] text-secondary-foreground [&_pre]:overflow-auto [&_pre]:!bg-transparent [&_pre]:px-[1em] [&_pre]:py-[1em]">
      <div :class="$props.class">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button';
import { toast } from 'vue-sonner'
import { useClipboard } from "@vueuse/core";

const { t } = useI18n();
const clipboard = useClipboard();
const props = defineProps({
  code: {
    type: String,
    default: ''
  },
  language: {
    type: String,
    default: null
  },
  filename: {
    type: String,
    default: null
  },
  highlights: {
    type: Array as () => number[],
    default: () => []
  },
  meta: {
    type: String,
    default: null
  },
  class: {
    type: String,
    default: null
  }
})

function downloadCode() {
  const blob = new Blob([props.code], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = props.filename || `code.${props.language || 'txt'}`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
  toast.success(t('files_saved'));
}

function copyCode() {
  clipboard.copy(props.code || '');
  toast.success(t('code_copied'));
}
</script>

<style>
pre code .line {
  display: block;
}
</style>
