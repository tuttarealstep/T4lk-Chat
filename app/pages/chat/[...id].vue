<script setup lang="ts">
definePageMeta({
    layout: 'chat'
})

const route = useRoute()
const i18n = useI18n()
const chatStore = useChatStore()

const threadId = Array.isArray(route.params.id) ? route.params.id[0] : route.params.id

const { data: thread } = await useFetch(`/api/thread/${threadId}`, {
    cache: 'force-cache'
})

if (!thread.value) {
    throw createError({ statusCode: 404, statusMessage: i18n.t('chat.notFound'), fatal: true })
}

// Set current thread in store
chatStore.setCurrentThread(threadId || null)

// Set page title reactively based on current thread from store
const title = computed(() => {
    const currentThread = chatStore.currentThread
    if (currentThread && currentThread.title) {
        return `${currentThread.title} - T4lk Chat`
    }
    return 'T4lk Chat'
})

useSeoMeta({
    title: title
})
</script>

<template>
    <Chat v-if="thread" :key="threadId" :thread-id="threadId" />
</template>