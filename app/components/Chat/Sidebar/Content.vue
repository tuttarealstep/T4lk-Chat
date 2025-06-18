<script setup lang="ts">
import {
    SidebarContent,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuAction,
    SidebarMenuItem,
    SidebarMenuButton,
} from '@/components/ui/sidebar'

import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import DeleteThread from '@/components/Chat/Dialog/DeleteThread.vue'
import RenameThread from '@/components/Chat/Dialog/RenameThread.vue'
import ShareThread from '@/components/Chat/Dialog/ShareThread.vue'
import { useChatStore } from '~/stores/chat'
import { toast } from 'vue-sonner'

import type { Thread } from '~/stores/chat'

const { t } = useI18n()
const chatStore = useChatStore()
const router = useRouter()
const route = useRoute()

// Use store data directly instead of useFetch
const groups = computed(() => {
    // SSR-safe: return empty array during SSR to avoid hydration mismatch
    if (import.meta.server) return []

    return chatStore.getGroupedThreads({
        pinned: t('chat.pinned'),
        today: t('date.today'),
        yesterday: t('date.yesterday'),
        lastWeek: t('date.last_week'),
        lastMonth: t('date.last_month')
    })
})

const deleteThread = async (threadId: string) => {
    try {
        await chatStore.deleteThread(threadId)

        // Redirect to home if current thread was deleted
        if (chatStore.currentThreadId === threadId) {
            await router.push('/')
        }

        toast.success(t('thread.deleted'))
    } catch (error) {
        console.error('Failed to delete thread:', error)
        toast.error(t('thread.delete_failed'))
    }
}

const renameThread = async (threadId: string, newName: string) => {
    try {
        await chatStore.updateThread(threadId, { title: newName })
        toast.success(t('thread.renamed'))
    } catch (error) {
        console.error('Failed to rename thread:', error)
        toast.error(t('thread.rename_failed'))
    }
}

// Dialog states
const deleteDialogOpen = ref(false)
const renameDialogOpen = ref(false)
const shareDialogOpen = ref(false)
const selectedThread = ref<Thread | null>(null)

const handlePinToggle = async (thread: Thread) => {
    try {
        await chatStore.toggleThreadPin(thread.id)
    } catch (error) {
        console.error('Error toggling pin:', error)
        toast.error(t('thread.pin_failed'))
    }
}

const handleRename = (thread: Thread) => {
    selectedThread.value = thread
    renameDialogOpen.value = true
}

const handleShare = (thread: Thread) => {
    selectedThread.value = thread
    shareDialogOpen.value = true
}

const handleDelete = (thread: Thread) => {
    selectedThread.value = thread
    deleteDialogOpen.value = true
}

const confirmRename = async (newTitle: string) => {
    if (selectedThread.value) {
        try {
            await renameThread(selectedThread.value.id, newTitle)
        } catch (error) {
            console.error('Error renaming thread:', error)
        }
    }
}

const confirmDelete = async () => {
    if (selectedThread.value) {
        try {
            await deleteThread(selectedThread.value.id)

            // Navigate to home if we're deleting the current thread
            const currentThreadId = Array.isArray(route.params.id) ? route.params.id[0] : route.params.id
            const selectedThreadId = selectedThread.value.id

            if (currentThreadId === selectedThreadId) {
                await router.push('/')
            }
        } catch (error) {
            console.error('Error deleting thread:', error)
        }
    }
}

// Navigation to thread
const navigateToThread = (threadId: string) => {
    router.push(`/chat/${threadId}`)
}

// Initialize threads on component mount
onMounted(async () => {
    if (chatStore.threads.length === 0) {
        await chatStore.loadThreads(true) // Force refresh to show loading state
    }
})
</script>

<template>
    <SidebarContent class="small-scrollbar scroll-shadow relative pb-2">
        <ClientOnly>
            <!-- Loading state for threads -->
            <ChatSidebarContentFallback v-if="chatStore.isLoadingThreads" />

            <!-- Thread groups -->
            <SidebarGroup v-for="group in groups" v-else-if="groups.length > 0" :key="group.id">
                <SidebarGroupLabel>
                    <Icon v-if="group.id === 'pinned'" name="lucide:pin" class="h-4 w-4 mr-2" />
                    {{ group.label }}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                    <SidebarMenu>
                        <SidebarMenuItem v-for="thread in group.items" :key="thread.id">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger as-child>
                                        <SidebarMenuButton
                                            class="cursor-pointer hover:bg-muted/50 transition-colors w-full"
                                            :class="{ 'bg-accent text-accent-foreground': chatStore.currentThreadId === thread.id }"
                                            @click="navigateToThread(thread.id)">
                                            <div class="relative flex w-full items-center">
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger as-child>
                                                            <Icon v-if="thread.branchedFromThreadId"
                                                                name="lucide:git-branch"
                                                                class="h-3 w-3 mr-2 text-muted-foreground" />
                                                        </TooltipTrigger>
                                                        <TooltipContent side="bottom" :side-offset="8">
                                                            <p class="max-w-xs text-sm"
                                                                v-if="thread.branchedFromThreadId">{{
                                                                $t('thread.branch_from') }}
                                                                {{
                                                                    chatStore.threads.find(t => t.id ===
                                                                        thread.branchedFromThreadId)?.title || ''
                                                                }}
                                                            </p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                                <span class="w-full truncate">
                                                    {{ thread.title }}
                                                </span>
                                                <Icon v-if="thread.generationStatus === 'generating'"
                                                    name="lucide:loader-circle" class="h-4 w-4 animate-spin" />
                                            </div>
                                        </SidebarMenuButton>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" :side-offset="8">
                                        <p class="max-w-xs text-sm">{{ thread.title }}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                            <SidebarMenuAction as-child>
                                <DropdownMenu>
                                    <DropdownMenuTrigger as-child>
                                        <SidebarMenuAction class="cursor-pointer">
                                            <Icon name="lucide:ellipsis" class="h-4 w-4" />
                                        </SidebarMenuAction>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent side="right" align="start">
                                        <DropdownMenuItem v-if="thread.pinned" class="cursor-pointer"
                                            @click="handlePinToggle(thread)">
                                            <Icon name="lucide:pin-off" class="h-4 w-4" />
                                            <span>{{ $t('thread.unpin') }}</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem v-if="!thread.pinned" class="cursor-pointer"
                                            @click="handlePinToggle(thread)">
                                            <Icon name="lucide:pin" class="h-4 w-4" />
                                            <span>{{ $t('thread.pin') }}</span>
                                        </DropdownMenuItem>                                        <DropdownMenuItem class="cursor-pointer" @click="handleRename(thread)">
                                            <Icon name="lucide:text-cursor" class="h-4 w-4" />
                                            <span>{{ $t('thread.rename') }}</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem class="cursor-pointer" @click="handleShare(thread)">
                                            <Icon name="lucide:share" class="h-4 w-4" />
                                            <span>{{ $t('thread.share') }}</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem class="cursor-pointer" @click="handleDelete(thread)">
                                            <Icon name="lucide:trash" class="h-4 w-4" />
                                            <span>{{ $t('thread.delete') }}</span>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </SidebarMenuAction>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarGroupContent>
            </SidebarGroup>

            <!-- Empty state when no threads and not loading -->
            <div v-else-if="!chatStore.isLoadingThreads" class="p-4 text-center text-muted-foreground">
                <Icon name="lucide:message-square" class="size-8 mx-auto mb-2" />
                <p class="text-sm">{{ t('chat.no_threads') }}</p>
            </div>

            <template #fallback>
                <ChatSidebarContentFallback />
            </template>
        </ClientOnly>
    </SidebarContent>    <!-- Dialogs -->
    <DeleteThread 
        v-if="selectedThread" 
        v-model:open="deleteDialogOpen" 
        :thread-title="selectedThread.title"
        @confirm="confirmDelete" 
    />

    <RenameThread 
        v-if="selectedThread" 
        v-model:open="renameDialogOpen" 
        :thread-title="selectedThread.title"
        @confirm="confirmRename" 
    />

    <ShareThread 
        v-if="selectedThread" 
        v-model:open="shareDialogOpen" 
        :thread-id="selectedThread.id"
        :thread-title="selectedThread.title"
    />
</template>