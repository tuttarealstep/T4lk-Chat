<script setup lang="ts">
import type { NuxtError } from '#app'
import { Button } from './components/ui/button';

const props = withDefaults(defineProps<{
    error?: NuxtError
}>(), {
    error: () => ({ statusCode: 500, statusMessage: 'Internal Server Error' } as NuxtError)
})

const router = useRouter()

const goHome = async () => {
    try {
        await router.push('/')
    } catch (error) {
        console.error('Failed to navigate home:', error)
        // Fallback to location reload if router fails
        window.location.href = '/'
    }
}
</script>

<template>
    <main class="min-h-screen flex flex-col items-center justify-center text-center">
        <p class="text-base font-semibold text-primary">{{ props.error?.statusCode }}</p>
        <h1 class="mt-2 text-4xl sm:text-5xl font-bold text-highlighted text-balance">{{ props.error?.message }}
        </h1>
        <div class="mt-8 flex items-center justify-center gap-6">
            <Button type="button" class="cursor-pointer" @click="goHome">{{ $t('go_back_home') }}</Button>
        </div>
    </main>
</template>
