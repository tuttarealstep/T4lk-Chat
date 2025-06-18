<script setup lang="ts">
import { Toaster } from '@/components/ui/sonner'
import 'vue-sonner/style.css'
</script>

<template>
    <slot />

    <Toaster class="pointer-events-auto" />
</template>