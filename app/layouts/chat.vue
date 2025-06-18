<script setup lang="ts">
import { SidebarProvider } from '@/components/ui/sidebar'

const { sidebarWidthStyle, isResizing, startResize } = useSidebarWidth()

// Cookie for sidebar open/close state
const defaultOpen = useCookie<boolean>("sidebar_state", {
    default: () => true
});

</script>

<template>
    <SidebarProvider :default-open="defaultOpen" :style="sidebarWidthStyle" class="flex w-full">
        <ChatSidebar :start-resize="startResize" :is-resizing="isResizing" />
        <ChatSidebarTrigger />
        <AppMain>
            <slot />
        </AppMain>
        <ChatCommandPalette />
    </SidebarProvider>
</template>