<script setup lang="ts">
import {
    SidebarFooter,
} from '@/components/ui/sidebar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

import { authClient } from '@/lib/auth'

const { data: session } = await authClient.useSession(useFetch);
</script>

<template>
    <SidebarFooter class="flex flex-col gap-2 m-0 p-2 pt-0">
        <NuxtLink
v-if="!session || session.user.isAnonymous" to="/auth"
            class="flex w-full select-none items-center gap-4 rounded-lg p-4 text-muted-foreground hover:bg-sidebar-accent">
            <Icon name="lucide:log-in" />
            {{ $t('login') }}
        </NuxtLink>
        <NuxtLink
v-if="session && !session.user.isAnonymous" to="/settings/customization"
            class="flex w-full select-none items-center gap-4 rounded-lg p-4 text-muted-foreground hover:bg-sidebar-accent">
            <Avatar>
                <AvatarImage
v-if="!session.user.isAnonymous && session.user.image" :src="session.user.image"
                    :alt="session.user.name || session.user.email" />
                <AvatarFallback>
                    <Icon name="lucide:user" class="!size-4" />
                </AvatarFallback>
            </Avatar>
            <div class="flex min-w-0 flex-col text-foreground">
                <span class="truncate text-sm font-medium">
                    {{ session.user.name || session.user.email }}
                </span>
            </div>
        </NuxtLink>
    </SidebarFooter>
</template>