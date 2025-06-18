<script setup lang="ts">
import { ref, computed } from 'vue';
import { Button } from '@/components/ui/button';
import { toast } from 'vue-sonner';
import { Icon } from '#components';

// Use chat layout
definePageMeta({
    layout: 'chat'
})

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const chatStore = useChatStore();

const shareId = computed(() => route.params.id as string);
const isLoading = ref(true);
const isCreatingChat = ref(false);
const shareData = ref<{
    shareId: string;
    name: string | null;
    thread: {
        id: string;
        title: string;
        createdAt: string;
    };
    messages: Array<{
        id: string;
        role: 'user' | 'assistant';
        parts: Array<{
            type: string;
            text?: string;
            reasoning?: string;
            mimeType?: string;
            data?: string;
            name?: string;
        }>;
        usage?: {
            promptTokens?: number;
            completionTokens?: number;
            totalTokens?: number;
        };
        model: string;
        generationStartAt?: string;
        generationEndAt?: string;
        createdAt: string;
    }>;
    createdAt: string;
    updatedAt: string;
} | null>(null);

const error = ref<string | null>(null);

// Load shared chat data
const loadShareData = async () => {
    if (!shareId.value) return;

    isLoading.value = true;
    error.value = null;

    try {
        const response = await $fetch(`/api/share/${shareId.value}`) as typeof shareData.value;

        if (response && 'error' in response) {
            throw new Error((response as { error: string }).error);
        }

        shareData.value = response;
    } catch (err) {
        console.error('Error loading shared chat:', err);
        error.value = err instanceof Error ? err.message : 'Failed to load shared chat';
    } finally {
        isLoading.value = false;
    }
};

// Create new chat from this share
const createChatFromShare = async () => {
    if (!shareId.value) return;

    isCreatingChat.value = true;

    try {
        const response = await $fetch(`/api/share/${shareId.value}/create-chat`, {
            method: 'POST'
        }) as { error?: string; threadUrl?: string };

        if (response.error) {
            throw new Error(response.error);
        }

        toast.success(t('share.chat_created'));

        // Redirect to the new chat
        if (response.threadUrl) {
            await router.push(response.threadUrl);

            // Reload chat threads after creating a new chat
            chatStore.loadThreads();
        }
    } catch (err) {
        console.error('Error creating chat from share:', err);
        toast.error(t('share.create_chat_error'));
    } finally {
        isCreatingChat.value = false;
    }
};

// Load data on mount
onMounted(() => {
    loadShareData();
});

// Set page meta
useHead({
    title: computed(() => shareData.value?.name || shareData.value?.thread.title || t('share.title')),
    meta: [
        {
            name: 'description',
            content: computed(() => t('share.page_description', {
                name: shareData.value?.name || shareData.value?.thread.title || ''
            }))
        }
    ]
});
</script>

<template>
    <!-- Loading state -->
    <div v-if="isLoading" class="flex h-full items-center justify-center">
        <div class="text-center">
            <Icon name="lucide:loader-circle" class="h-8 w-8 animate-spin mx-auto mb-4" />
            <p class="text-muted-foreground">{{ $t('share.loading') }}</p>
        </div>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="flex h-full items-center justify-center">
        <div class="text-center max-w-md">
            <Icon name="lucide:alert-circle" class="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 class="text-lg font-semibold mb-2">{{ $t('share.not_found_title') }}</h2>
            <p class="text-muted-foreground mb-4">{{ $t('share.not_found_description') }}</p>
            <Button @click="router.push('/')">
                <Icon name="lucide:home" class="h-4 w-4 mr-2" />
                {{ $t('share.go_home') }}
            </Button>
        </div>
    </div>

    <!-- Chat content using existing components -->
    <div v-else-if="shareData" class="relative flex flex-col h-full">

        <!-- Chat content with padding for header and footer -->
        <div class="pt-16 pb-20 flex-1">
            <ChatReadOnly :share-data="shareData" />
        </div>

        <!-- Share footer -->
        <div class="z-10 bg-background/95 backdrop-blur border-b">
            <div class="flex items-center justify-between px-4 py-2">
                <div class="flex items-center gap-3">
                    <Icon name="lucide:share" class="h-4 w-4 text-muted-foreground" />
                    <div>
                        <h1 class="font-medium text-sm">
                            {{ shareData.name || shareData.thread.title }}
                        </h1>
                        <p class="text-xs text-muted-foreground">
                            {{ $t('share.shared_chat') }}
                        </p>
                    </div>
                </div>

                <div class="flex items-center gap-2">
                    <Button size="sm" :disabled="isCreatingChat" @click="createChatFromShare">
                        <Icon v-if="isCreatingChat" name="lucide:loader-circle" class="h-3 w-3 animate-spin mr-1" />
                        <Icon v-else name="lucide:message-square-plus" class="h-3 w-3 mr-1" />
                        {{ $t('share.create_new_chat') }}
                    </Button>

                    <Button variant="outline" size="sm" @click="router.push('/')">
                        <Icon name="lucide:home" class="h-3 w-3 mr-1" />
                        {{ $t('share.go_home') }}
                    </Button>
                </div>
            </div>
        </div>
    </div>
</template>
