<script setup lang="ts">
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useCommandPalette } from '~/composables/useCommandPalette'
import { formatDistanceToNow } from 'date-fns'
import { it, enUS } from 'date-fns/locale'
import type { Thread } from '~/stores/chat'

const { t, locale } = useI18n()

const {
    isOpen,
    searchQuery,
    selectedIndex,
    filteredThreads,
    closePalette,
    handleSelect
} = useCommandPalette()

// Debug log
console.log('CommandPalette component loaded, isOpen:', isOpen.value)

const inputRef = ref<HTMLInputElement | null>(null)

// Focus input when dialog opens
watch(isOpen, (newValue) => {
    if (newValue) {
        nextTick(() => {
            const input = inputRef.value
            if (input && typeof input.focus === 'function') {
                input.focus()
            }
        })
    }
})

// Format relative time
const formatRelativeTime = (date: Date) => {
    const dateLocale = locale.value === 'it' ? it : enUS
    return formatDistanceToNow(date, { 
        addSuffix: true, 
        locale: dateLocale 
    })
}

// Handle item click
const handleItemClick = (index: number) => {
    selectedIndex.value = index
    handleSelect()
}

// Auto-scroll to selected item
const scrollToSelectedItem = () => {
    nextTick(() => {
        const selectedElement = document.querySelector(`[data-item-index="${selectedIndex.value}"]`)
        if (selectedElement) {
            selectedElement.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'nearest' 
            })
        }
    })
}

// Watch for selectedIndex changes to auto-scroll
watch(selectedIndex, () => {
    scrollToSelectedItem()
})

// Get the visual items (including "Create new chat" option)
const displayItems = computed(() => {    const items: Array<{
        type: 'new-chat' | 'thread'
        title: string
        subtitle: string
        id: string
        pinned?: boolean | null
        thread?: Thread
    }> = []
    
    // Add "Create new chat" option if there's a search query
    if (searchQuery.value.trim()) {
        items.push({
            type: 'new-chat',
            title: t('command_palette.create_new_chat'),
            subtitle: `"${searchQuery.value.trim()}"`,
            id: 'new-chat'
        })
    }
    
    // Add filtered threads
    filteredThreads.value.forEach(thread => {
        items.push({
            type: 'thread',
            title: thread.title,
            subtitle: formatRelativeTime(thread.updatedAt),
            id: thread.id,
            pinned: thread.pinned,
            thread
        })
    })
    
    return items
})
</script>

<template>
    <Dialog :open="isOpen" @update:open="closePalette">
        <DialogContent class="sm:max-w-[600px] p-0 gap-0" @pointer-down-outside="closePalette">
            <DialogHeader class="px-4 pt-4 pb-2">
                <DialogTitle class="sr-only">{{ t('command_palette.title') }}</DialogTitle>
                <DialogDescription class="sr-only">{{ t('command_palette.description') }}</DialogDescription>
            </DialogHeader>
            
            <!-- Search Input -->
            <div class="px-4 pb-2">
                <div class="relative">
                    <Icon name="lucide:search" class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />                    <Input
                        ref="inputRef"
                        v-model="searchQuery"
                        :placeholder="t('command_palette.placeholder')"
                        class="pl-10 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                        @keydown.enter.prevent="handleSelect"
                        @keydown.escape.prevent="closePalette"
                    />
                </div>
            </div>            <!-- Results -->
            <div class="border-t">
                <div v-if="displayItems.length > 0" class="max-h-[400px] overflow-y-auto">
                    <div class="p-2">                        <div
                            v-for="(item, index) in displayItems"
                            :key="item.id"
                            :data-item-index="index"
                            :class="[
                                'flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm cursor-pointer transition-colors',
                                selectedIndex === index
                                    ? 'bg-accent text-accent-foreground'
                                    : 'hover:bg-accent/50'
                            ]"
                            @click="handleItemClick(index)"
                        >
                            <!-- Icon -->
                            <div class="flex-shrink-0">
                                <Icon
                                    v-if="item.type === 'new-chat'"
                                    name="lucide:plus"
                                    class="h-4 w-4 text-muted-foreground"
                                />
                                <Icon
                                    v-else-if="item.pinned"
                                    name="lucide:pin"
                                    class="h-4 w-4 text-muted-foreground"
                                />
                                <Icon
                                    v-else
                                    name="lucide:message-square"
                                    class="h-4 w-4 text-muted-foreground"
                                />
                            </div>

                            <!-- Content -->
                            <div class="flex-1 min-w-0">
                                <div class="font-medium truncate">{{ item.title }}</div>
                                <div class="text-xs text-muted-foreground truncate">{{ item.subtitle }}</div>
                            </div>

                            <!-- Badge for pinned threads -->
                            <div v-if="item.type === 'thread' && item.pinned" class="flex-shrink-0">
                                <Badge variant="secondary" class="text-xs">
                                    {{ t('chat.pinned') }}
                                </Badge>
                            </div>

                            <!-- Keyboard shortcut hint -->
                            <div v-if="selectedIndex === index" class="flex-shrink-0">
                                <Badge variant="outline" class="text-xs">
                                    <Icon name="lucide:corner-down-left" class="h-3 w-3" />
                                </Badge>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Empty state -->
                <div v-else class="p-8 text-center text-muted-foreground">
                    <Icon name="lucide:search" class="h-8 w-8 mx-auto mb-2" />
                    <p class="text-sm">{{ t('command_palette.no_results') }}</p>
                </div>
            </div>

            <!-- Footer with shortcuts -->
            <div class="border-t px-4 py-2 text-xs text-muted-foreground bg-muted/50">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-4">
                        <div class="flex items-center gap-1">
                            <Badge variant="outline" class="text-xs px-1">
                                <Icon name="lucide:corner-down-left" class="h-3 w-3" />
                            </Badge>
                            <span>{{ t('command_palette.select') }}</span>
                        </div>
                        <div class="flex items-center gap-1">
                            <Badge variant="outline" class="text-xs px-1">↑↓</Badge>
                            <span>{{ t('command_palette.navigate') }}</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-1">
                        <Badge variant="outline" class="text-xs px-1">Esc</Badge>
                        <span>{{ t('command_palette.close') }}</span>
                    </div>
                </div>
            </div>
        </DialogContent>
    </Dialog>
</template>
