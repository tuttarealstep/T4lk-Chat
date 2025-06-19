<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { useSidebar } from '@/components/ui/sidebar/utils'
import { useChatNavigation } from '~/composables/useChatNavigation'
import { useCommandPalette } from '~/composables/useCommandPalette'

const { toggleSidebar, state, isMobile, open } = useSidebar()
const { navigateToNewChat } = useChatNavigation()
const { openPalette } = useCommandPalette()

const newThread = async () => {
    try {
        await navigateToNewChat()
    } catch (error) {
        console.error('Failed to navigate to new chat:', error)
    }
}

const search = () => {
    openPalette()
}

</script>

<template>
    <div class="pointer-events-auto fixed left-2 z-50 flex flex-row gap-0.5 p-1 top-safe-offset-2">
        <ClientOnly>
            <svg v-if="state === 'expanded' && isMobile && open"
                class="absolute -right-8 h-9 origin-top-left overflow-visible mt-0.5 translate-x-[calc(4rem+10px)] skew-x-[30deg] -scale-x-100 max-sm:hidden"
                version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
                viewBox="0 0 128 32" xml:space="preserve">
                <line stroke="hsl(var(--gradient-noise-top))" stroke-width="2px" shape-rendering="optimizeQuality"
                    vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-miterlimit="10" x1="1" y1="0"
                    x2="128" y2="0" />
                <path stroke="hsl(var(--chat-border))" class="translate-y-[0.5px]" fill="hsl(var(--gradient-noise-top))"
                    shape-rendering="optimizeQuality" stroke-width="1px" stroke-linecap="round" stroke-miterlimit="10"
                    vector-effect="non-scaling-stroke"
                    d="M0,0c5.9,0,10.7,4.8,10.7,10.7v10.7c0,5.9,4.8,10.7,10.7,10.7H128V0" />
            </svg>
        </ClientOnly>
        <div class="pointer-events-none absolute inset-0 right-auto -z-10 rounded-md backdrop-blur-sm transition-[background-color,width] max-sm:delay-125 max-sm:duration-125 max-sm:w-[6.75rem] max-sm:bg-sidebar/50  sm:!backdrop-filter-none"
            :class="{
                'delay-0 duration-250 w-10 bg-transparent': state === 'expanded',
                'delay-125 duration-125 w-[6.75rem] bg-sidebar/50 blur-fallback:bg-sidebar': state === 'collapsed',
            }" />
        <Button data-sidebar="trigger" data-slot="sidebar-trigger" variant="ghost" size="icon"
            class="z-10 h-8 w-8 text-muted-foreground cursor-pointer" @click="toggleSidebar">
            <Icon name="lucide:panel-left" class="!size-4" />
            <span class="sr-only">{{ $t('toggle_sidebar') }}</span>
        </Button>
        <Button variant="ghost" size="icon" class="text-muted-foreground duration-250 size-8 translate-x-0 opacity-100 cursor-pointer
            disabled:opacity-50
            " :class="{
                'transition-all delay-150 ease-in-out': state === 'collapsed',
                'sm:pointer-events-none sm:-translate-x-[2.125rem] sm:opacity-0 sm:delay-0 sm:duration-250': state === 'expanded'
            }" @click="search">
            <Icon name="lucide:search" class="!size-4" />
            <span class="sr-only">{{ $t('search') }}</span>
        </Button>
        <Button variant="ghost" size="icon"
            class="text-muted-foreground duration-250 size-8 translate-x-0 opacity-100 cursor-pointer" :class="{
                'transition-all delay-150 ease-in-out': state === 'collapsed',
                'sm:pointer-events-none sm:-translate-x-[2.125rem] sm:opacity-0 sm:delay-0 sm:duration-150': state === 'expanded'
            }" @click="newThread">
            <Icon name="lucide:plus" class="!size-4" />
            <span class="sr-only">{{ $t('new_thread') }}</span>
        </Button>
    </div>
</template>