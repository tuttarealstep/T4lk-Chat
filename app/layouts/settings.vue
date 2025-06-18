<script setup lang="ts">
const route = useRoute()

// Get the current tab from the route
const currentTab = computed(() => {
    const pathSegments = route.path.split('/')
    const lastSegment = pathSegments[pathSegments.length - 1]
    return lastSegment === 'settings' ? 'api-keys' : lastSegment
})
</script>

<template>
    <AppMain>
        <div class="max-h-screen w-full overflow-y-auto z-1">
            <div class="pt-safe-offset-10">
                <div class="container mx-auto p-6 max-w-4xl">
                    <!-- Custom Tab Navigation -->
                    <div class="w-full mb-8">
                        <div class="grid w-full grid-cols-2 gap-1 p-1 bg-muted rounded-lg">
                            <NuxtLink to="/settings/customization" :class="[
                                'inline-flex h-9 items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                                'disabled:pointer-events-none disabled:opacity-50',
                                currentTab === 'customization'
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:bg-background/50 hover:text-foreground'
                            ]">
                                {{ $t('settings_pages.customization.title') }}
                            </NuxtLink>
                            <NuxtLink to="/settings/api-keys" :class="[
                                'inline-flex h-9 items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                                'disabled:pointer-events-none disabled:opacity-50',
                                currentTab === 'api-keys'
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:bg-background/50 hover:text-foreground'
                            ]">
                                {{ $t('settings_pages.api_keys.title') }}
                            </NuxtLink>
                        </div>
                    </div>

                    <!-- Content Area -->
                    <div class="mt-6">
                        <slot />
                    </div>
                </div>
            </div>
        </div>
    </AppMain>
</template>