<script setup lang="ts">
import {
    Sidebar,
    type SidebarProps,
    useSidebar,
} from '@/components/ui/sidebar'

interface ChatSidebarProps extends SidebarProps {
    startResize?: (event: MouseEvent | TouchEvent) => void
}

const props = withDefaults(defineProps<ChatSidebarProps>(), {
})

const { state } = useSidebar()

</script>

<template>
    <div
        class="fixed inset-0 top-0 h-full w-full bottom-0 box-content overflow-hidden bg-gradient-noise-top/80 backdrop-blur-md transition-[transform,border] ease-snappy blur-fallback:bg-gradient-noise-top"/>

    <Sidebar class="p-2 !border-r-0" v-bind="props">
        <ChatSidebarHeader />
        <ChatSidebarContent />
        <ChatSidebarFooter />
        <div
class="absolute right-0 top-0 h-full w-2 cursor-col-resize" @mousedown="props.startResize"
            @touchstart="props.startResize"/>
    </Sidebar>
</template>

<style lang="css">
.scroll-shadow:not([data-shadow=false]) {
    --shadow-height: 20px;
    --scrollbar-width: 8px;
    mask-image: linear-gradient(to bottom, transparent, #000 var(--shadow-height), #000 calc(100% - var(--shadow-height)), transparent 100%),
        linear-gradient(to left, #fff var(--scrollbar-width), transparent var(--scrollbar-width));
}
</style>