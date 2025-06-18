<script setup lang="ts">
import { SidebarHeader } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Kbd } from '@/components/ui/kbd';
import { Button } from '@/components/ui/button';
import { useChatStore } from '~/stores/chat'
import { useChatNavigation } from '~/composables/useChatNavigation'
import { useMagicKeys } from '@vueuse/core'

const chatStore = useChatStore();
const { navigateToNewChat } = useChatNavigation()

// Local reactive value for search
const searchQuery = ref(chatStore.searchQuery)

// Watch for changes and update store
watch(searchQuery, (newQuery) => {
    chatStore.setSearchQuery(newQuery)
})

// Watch store changes and update local value
watch(() => chatStore.searchQuery, (newQuery) => {
    searchQuery.value = newQuery
})

const clearSearch = () => {
    searchQuery.value = ''
    chatStore.setSearchQuery('')
}

const handleNewChat = async () => {
    try {
        await navigateToNewChat()
    } catch (error) {
        console.error('Failed to navigate to new chat:', error)
    }
}


const { Ctrl_Shift_O } = useMagicKeys()

watchEffect(() => {
    if (Ctrl_Shift_O?.value)
        handleNewChat()
})

</script>

<template>
    <SidebarHeader class="flex flex-col gap-2 relative m-1 mb-0 space-y-1 p-0 !pt-safe">
        <h1
            class="flex h-8 shrink-0 items-center justify-center text-lg text-muted-foreground transition-opacity delay-75 duration-75">
            <button
                class="relative flex h-8 w-24 items-center justify-center text-sm font-semibold text-foreground cursor-pointer"
                @click="handleNewChat">
                <div class="select-none text-xl">
                    T4lk
                </div>
            </button>
        </h1>
        <div class="px-1">
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger as-child>
                        <Button class="w-full cursor-pointer" as-child>
                            <button @click="handleNewChat">
                                {{ $t('new_chat') }}
                            </button>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                        <div class="flex gap-1">
                            <Kbd>Ctrl</Kbd>
                            <Kbd>Shift</Kbd>
                            <Kbd>O</Kbd>
                        </div>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
        <div class="border-b px-3">
            <div class="flex items-center">
                <Icon name="lucide:search" class="-ml-[3px] mr-3 !size-4 text-muted-foreground" />
                <input v-model="searchQuery" role="searchbox" :aria-label="$t('search_threads')"
                    :placeholder="$t('search_your_threads')"
                    class="w-full bg-transparent py-2 text-sm text-foreground placeholder-muted-foreground/50 placeholder:select-none focus:outline-none">
                <button v-if="searchQuery"
                    class="ml-2 rounded-md p-1 text-muted-foreground hover:bg-muted/40 cursor-pointer"
                    :aria-label="$t('clear_search')" :title="$t('clear_search')" @click="clearSearch">
                    <Icon name="lucide:x" class="size-4" />
                    <span class="sr-only">{{ $t('clear_search') }}</span>
                </button>
            </div>
        </div>
    </SidebarHeader>
</template>