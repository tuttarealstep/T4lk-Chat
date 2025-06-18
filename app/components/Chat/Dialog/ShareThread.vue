<script setup lang="ts">
import { ref, computed } from 'vue';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'vue-sonner';
import { Icon } from '#components';

interface Props {
    open: boolean;
    threadId: string;
    threadTitle: string;
}

interface Emits {
    (e: 'update:open', value: boolean): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { t } = useI18n();

const shareName = ref('');
const isLoading = ref(false);
const isLoadingInfo = ref(false);
const shareInfo = ref<{
    hasShare: boolean;
    shareId?: string;
    shareUrl?: string;
    name?: string;
    messageCount?: number;
    createdAt?: string;
    updatedAt?: string;
} | null>(null);

// Computed property for dialog open state
const dialogOpen = computed({
    get: () => props.open,
    set: (value: boolean) => emit('update:open', value)
});

// Load share info when dialog opens
const loadShareInfo = async () => {
    if (!props.threadId) return;

    isLoadingInfo.value = true;
    try {
        const response = await $fetch(`/api/thread/${props.threadId}/share`) as {
            hasShare: boolean;
            shareId?: string;
            shareUrl?: string;
            name?: string;
            messageCount?: number;
            createdAt?: string;
            updatedAt?: string;
            error?: string;
        };

        if (response.error) {
            throw new Error(response.error);
        }
        shareInfo.value = response;

        if (shareInfo.value?.hasShare && shareInfo.value?.name) {
            shareName.value = shareInfo.value.name;
        } else {
            // Se non c'è un nome per la condivisione, lascia vuoto
            shareName.value = '';
        }
    } catch (error) {
        console.error('Error loading share info:', error);
        toast.error(t('share.load_error'));
        shareInfo.value = { hasShare: false };
        shareName.value = props.threadTitle;
    } finally {
        isLoadingInfo.value = false;
    }
};

// Watch for dialog open to load share info
watch(() => props.open, (open) => {
    if (open) {
        loadShareInfo();
    }
});

// Create or update share
const createShare = async () => {
    isLoading.value = true;
    try {
        const body: { name?: string } = {};

        // Solo aggiungere il nome se non è vuoto
        const trimmedName = shareName.value.trim();
        if (trimmedName) {
            body.name = trimmedName;
        } const response = await $fetch(`/api/thread/${props.threadId}/share`, {
            method: 'POST',
            body
        }) as {
            shareId?: string;
            shareUrl?: string;
            name?: string | null;
            messageCount?: number;
            error?: string;
        };

        if (response.error) {
            throw new Error(response.error);
        }

        toast.success(shareInfo.value?.hasShare ? t('share.updated') : t('share.created'));

        // Reload share info
        await loadShareInfo();
    } catch (error) {
        console.error('Error creating/updating share:', error);
        toast.error(t('share.create_error'));
    } finally {
        isLoading.value = false;
    }
};

// Delete share
const deleteShare = async () => {
    isLoading.value = true;
    try {
        const response = await $fetch(`/api/thread/${props.threadId}/share`, {
            method: 'DELETE'
        }) as { success?: boolean; error?: string };

        if (response.error) {
            throw new Error(response.error);
        }

        toast.success(t('share.deleted'));
        shareInfo.value = { hasShare: false };
        shareName.value = props.threadTitle;
    } catch (error) {
        console.error('Error deleting share:', error);
        toast.error(t('share.delete_error'));
    } finally {
        isLoading.value = false;
    }
};

// Computed for full share URL
const fullShareUrl = computed(() => {
    if (!shareInfo.value?.shareUrl) return '';
    if (import.meta.client) {
        return `${window.location.origin}${shareInfo.value.shareUrl}`;
    }
    return shareInfo.value.shareUrl;
});

// Copy share URL to clipboard
const copyShareUrl = async () => {
    if (!shareInfo.value?.shareUrl || !import.meta.client) return;

    try {
        const fullUrl = `${window.location.origin}${shareInfo.value.shareUrl}`;
        await navigator.clipboard.writeText(fullUrl);
        toast.success(t('share.copied'));
    } catch (error) {
        console.error('Error copying to clipboard:', error);
        toast.error(t('share.copy_error'));
    }
};

// Open share in new tab
const openShare = () => {
    if (!shareInfo.value?.shareUrl || !import.meta.client) return;
    window.open(shareInfo.value.shareUrl, '_blank');
};
</script>

<template>
    <Dialog v-model:open="dialogOpen">
        <DialogContent class="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>{{ $t('share.title') }}</DialogTitle>
                <DialogDescription>
                    {{ $t('share.description') }}
                </DialogDescription>
            </DialogHeader>

            <!-- Loading state -->
            <div v-if="isLoadingInfo" class="flex items-center justify-center py-8">
                <Icon name="lucide:loader-circle" class="h-6 w-6 animate-spin" />
            </div>

            <!-- No share exists -->
            <div v-else-if="!shareInfo?.hasShare" class="space-y-4">
                <div class="space-y-2">
                    <Label for="share-name">{{ $t('share.name_label') }}</Label>
                    <Input id="share-name" v-model="shareName" :placeholder="$t('share.name_placeholder')"
                        :disabled="isLoading" />
                </div>

                <div class="flex justify-end space-x-2"> <Button variant="outline" :disabled="isLoading"
                        @click="dialogOpen = false">
                        {{ $t('common.cancel') }}
                    </Button> <Button :disabled="isLoading" @click="createShare">
                        <Icon v-if="isLoading" name="lucide:loader-circle" class="h-4 w-4 animate-spin mr-2" />
                        {{ $t('share.create') }}
                    </Button>
                </div>
            </div>

            <!-- Share exists -->
            <div v-else class="space-y-4">
                <div class="space-y-2">
                    <Label for="share-name">{{ $t('share.name_label') }}</Label>
                    <Input id="share-name" v-model="shareName" :placeholder="$t('share.name_placeholder')"
                        :disabled="isLoading" />
                </div>

                <!-- Share info -->
                <div class="bg-muted/50 rounded-lg p-4 space-y-3">
                    <div class="flex items-center gap-2">
                        <Icon name="lucide:link" class="h-4 w-4 text-muted-foreground" />
                        <span class="text-sm font-medium">{{ $t('share.share_url') }}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <Input :model-value="fullShareUrl" readonly class="flex-1 text-xs" />
                        <Button size="sm" variant="outline" @click="copyShareUrl">
                            <Icon name="lucide:copy" class="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" @click="openShare">
                            <Icon name="lucide:external-link" class="h-4 w-4" />
                        </Button>
                    </div>

                    <div class="text-xs text-muted-foreground">
                        {{ $t('share.message_count', { count: shareInfo.messageCount || 0 }) }}
                    </div>
                </div>

                <div class="flex gap-2 justify-between">
                    <Button variant="secondary" size="sm" :disabled="isLoading" @click="deleteShare">
                        <Icon v-if="isLoading" name="lucide:loader-circle" class="h-4 w-4 animate-spin mr-2" />
                        <Icon v-else name="lucide:trash" class="h-4 w-4 mr-2" />
                        {{ $t('share.delete') }}
                    </Button>
                    <Button type="button" variant="destructive" size="sm"
                        :disabled="isLoading || shareName.trim() === shareInfo.name" @click="createShare">
                        <Icon v-if="isLoading" name="lucide:loader-circle" class="h-4 w-4 animate-spin mr-2" />
                        <Icon v-else name="lucide:refresh-cw" class="h-4 w-4 mr-2" />
                        {{ $t('share.update') }}
                    </Button>
                </div>

                <div class="flex justify-end">
                    <Button variant="outline" :disabled="isLoading" @click="dialogOpen = false">
                        {{ $t('common.close') }}
                    </Button>
                </div>
            </div>
        </DialogContent>
    </Dialog>
</template>
