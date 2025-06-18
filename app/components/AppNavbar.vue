<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth'
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'

const route = useRoute()
const router = useRouter()
const colorMode = useColorMode()
const sidebar = useSidebar()
const { clearAllUserData } = useAuthCleanup()

const sidebarState = computed(() => {
    return sidebar?.state?.value
})

const isSettingsPage = computed(() => {
    return route.path.startsWith('/settings')
})

// Store the previous chat URL when entering settings
const previousChatUrl = ref<string>('/')

// Watch for route changes to track chat URLs
watch(() => route.path, (newPath, oldPath) => {
    // If we're coming from a chat page and going to settings, store the chat URL
    if (oldPath && oldPath.startsWith('/chat/') && newPath.startsWith('/settings')) {
        previousChatUrl.value = oldPath
    }
    // If we're on a chat page, update the stored URL
    else if (newPath.startsWith('/chat/')) {
        previousChatUrl.value = newPath
    }
}, { immediate: true })

const goBackToChat = () => {
    router.push(previousChatUrl.value)
}

const handleLogout = async () => {
    try {
        // Clear all user data before signing out
        clearAllUserData()
        
        // Sign out from better-auth
        await authClient.signOut({
            fetchOptions: {
                onSuccess: () => {                    // Sign in as anonymous user
                    authClient.signIn.anonymous()
                    router.push('/')
                },
            }
        })
    } catch (error) {
        console.error('Error during logout:', error)
    }
}
</script>

<template>
    <div class="absolute bottom-0 top-0 w-full overflow-hidden border-l border-t border-chat-border bg-chat-background bg-fixed pb-[140px] transition-all ease-snappy max-sm:border-none sm:translate-y-3.5"
        :class="{
            'sm:rounded-tl-xl': sidebar,
            '!translate-y-0 !rounded-none border-none': sidebarState === 'collapsed',
        }">
        <div class="bg-noise absolute inset-0 -top-3.5 bg-fixed transition-transform ease-snappy [background-position:right_bottom]"
            :class="{
                'translate-y-3.5': sidebarState === 'collapsed',
            }" />
    </div>

    <div class="absolute inset-x-3 top-0 z-10 box-content border-b border-chat-border bg-gradient-noise-top/80 backdrop-blur-md transition-[transform,border] ease-snappy blur-fallback:bg-gradient-noise-top max-sm:hidden sm:h-3.5
    " :class="{
        '-translate-y-[15px] border-transparent': sidebarState === 'collapsed',
    }">
        <div class="absolute -left-3 top-0 h-full w-3 bg-gradient-noise-top/80" />
        <div
            class="absolute left-0 top-0 h-full w-8 bg-gradient-to-r from-gradient-noise-top to-transparent blur-fallback:hidden" />
        <div
            class="absolute right-24 top-0 h-full w-8 bg-gradient-to-l from-gradient-noise-top to-transparent blur-fallback:hidden" />
        <div class="absolute right-0 top-0 h-full w-24 bg-gradient-noise-top blur-fallback:hidden" />
    </div>

    <div class="fixed right-0 top-0 z-20 h-16 w-28 max-sm:hidden">
        <div class="group pointer-events-none absolute top-3.5 z-10 -mb-8 h-32 w-full origin-top transition-all ease-snappy"
            :class="{
                '-translate-y-3.5 scale-y-0': sidebarState === 'collapsed',
            }" style="box-shadow: 10px -10px 8px 2px var(--gradient-noise-top);">
            <svg class="absolute -right-8 h-9 origin-top-left skew-x-[30deg] overflow-visible" version="1.1"
                xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 128 32"
                xml:space="preserve">
                <line stroke="var(--gradient-noise-top)" stroke-width="2px" shape-rendering="optimizeQuality"
                    vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-miterlimit="10" x1="1" y1="0"
                    x2="128" y2="0" />
                <path stroke="var(--chat-border)" class="translate-y-[0.5px]" fill="var(--gradient-noise-top)"
                    shape-rendering="optimizeQuality" stroke-width="1px" stroke-linecap="round" stroke-miterlimit="10"
                    vector-effect="non-scaling-stroke"
                    d="M0,0c5.9,0,10.7,4.8,10.7,10.7v10.7c0,5.9,4.8,10.7,10.7,10.7H128V0" />
            </svg>
        </div>
    </div>

    <div class="fixed right-2 top-2 z-20">
        <div class="relative flex flex-row items-center text-muted-foreground gap-0.5 rounded-md p-1 transition-all"
            :class="{
                'min-sm:rounded-bl-xl': sidebarState === 'expanded' || !sidebarState,
                'bg-sidebar/50 backdrop-blur-sm blur-fallback:bg-sidebar': sidebarState === 'collapsed',
            }">
            <div
                class="pointer-events-none absolute w-full inset-0 -z-10 rounded-md backdrop-blur-sm transition-[background-color,width] max-sm:delay-125 max-sm:duration-125 max-sm:bg-sidebar/50 sm:!backdrop-filter-none delay-0 duration-250 bg-transparent" />
            <TooltipProvider v-if="!isSettingsPage">
                <Tooltip>
                    <TooltipTrigger as-child>
                        <Button variant="ghost" size="icon"
                            class="size-8 cursor-pointer relative group flex items-center justify-center" :class="{
                                'min-sm:rounded-bl-xl': sidebarState === 'expanded' || !sidebarState,
                            }" as-child>
                            <NuxtLink to="/settings/customization" class="flex items-center justify-center">
                                <Icon name="lucide:settings-2" class="!size-4" />
                                <span class="sr-only">{{ $t('settings') }}</span>
                            </NuxtLink>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                        {{ $t('settings') }}
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <TooltipProvider v-if="isSettingsPage">
                <Tooltip>
                    <TooltipTrigger as-child>
                        <Button variant="ghost" size="icon"
                            class="size-8 cursor-pointer relative group flex items-center justify-center" :class="{
                                'min-sm:rounded-bl-xl': sidebarState === 'expanded' || !sidebarState,
                            }" @click="handleLogout">
                            <Icon name="lucide:log-out" class="!size-4" />
                            <span class="sr-only">{{ $t('logout') }}</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                        {{ $t('logout') }}
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
                <Tooltip>
                    <ContextMenu>
                        <ContextMenuTrigger as-child>
                            <TooltipTrigger as-child>
                                <Button ref="theme-toggle-button" variant="ghost" size="icon"
                                    class="size-8 cursor-pointer relative group flex items-center justify-center"
                                    :title="$t('toggle_theme')"
                                    @click="colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'">
                                    <ClientOnly>
                                        <Icon name="lucide:sun-moon"
                                            class="absolute transition-all duration-200 !size-4" :class="{
                                                'rotate-0 scale-100 transition-all': colorMode.value === 'system',
                                                '-rotate-90 scale-0': colorMode.value !== 'system'
                                            }" />
                                        <Icon name="lucide:moon" class="absolute transition-all duration-200 !size-4"
                                            :class="{
                                                'rotate-0 scale-100 transition-all': colorMode.value === 'light',
                                                '-rotate-90 scale-0': colorMode.value !== 'light'
                                            }" />
                                        <Icon name="lucide:sun" class="absolute transition-all duration-200 !size-4"
                                            :class="{
                                                'rotate-0 scale-100 transition-all': colorMode.value === 'dark',
                                                '-rotate-90 scale-0': colorMode.value !== 'dark'
                                            }" />
                                        <template #fallback>
                                            <Icon name="lucide:loader" class="animate-spin !size-4" />
                                        </template>
                                    </ClientOnly>
                                    <span class="sr-only">{{ $t('toggle_theme') }}</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                {{ $t('toggle_theme') }}
                            </TooltipContent>
                        </ContextMenuTrigger>
                        <ChatContextMenuTheme />
                    </ContextMenu>
                </Tooltip>
            </TooltipProvider>
        </div>
    </div>

    <div v-if="!sidebar" class="fixed left-2 top-2 sm:top-6 z-20 transition-all ease-snappy">
        <div class="relative flex flex-row items-center text-muted-foreground gap-0.5 rounded-md p-1 transition-all"
            :class="{
                'bg-sidebar/50 backdrop-blur-sm blur-fallback:bg-sidebar': sidebarState === 'collapsed',
            }">
            <div
                class="pointer-events-none absolute w-full inset-0 -z-10 rounded-md backdrop-blur-sm transition-[background-color,width] delay-125 duration-125 bg-sidebar/50 delay-0" />
            <Button variant="ghost" class="z-10 text-muted-foreground h-8 cursor-pointer flex items-center justify-center
                    " @click="goBackToChat()">
                <Icon name="lucide:arrow-left" class="mr-2" />
                {{ $t('back_to_chat') }}
            </Button>
        </div>
    </div>
</template>