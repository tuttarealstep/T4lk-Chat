<script setup lang="ts">
import { ContextMenuContent, ContextMenuItem } from '@/components/ui/context-menu'
</script>

<template>
    <ClientOnly>
        <ContextMenuContent class="min-w-[8rem]">
            <ContextMenuItem @click="$colorMode.preference = 'light'">
                <Icon name="lucide:sun" class="!size-4" />
                <span class="flex w-full items-center justify-between gap-2">
                    {{ $t('light') }}
                    <Icon v-if="$colorMode.preference === 'light'" name="lucide:check" class="!size-4" />
                </span>
            </ContextMenuItem>
            <ContextMenuItem @click="$colorMode.preference = 'dark'">
                <Icon name="lucide:moon" class="!size-4" />
                <span class="flex w-full items-center justify-between gap-2">
                    {{ $t('dark') }}
                    <Icon v-if="$colorMode.preference === 'dark'" name="lucide:check" class="!size-4" />
                </span>
            </ContextMenuItem>
            <ContextMenuItem @click="$colorMode.preference = 'system'">
                <Icon name="lucide:sun-moon" class="!size-4" />
                <span class="flex w-full items-center justify-between gap-2">
                    {{ $t('system') }}
                    <Icon v-if="$colorMode.preference === 'system'" name="lucide:check" class="!size-4" />
                </span>
            </ContextMenuItem>
        </ContextMenuContent>
    </ClientOnly>
</template>