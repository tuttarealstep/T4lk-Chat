<script setup lang="ts">
import { ShikiCachedRenderer } from 'shiki-stream/vue'

const colorMode = useColorMode()
const highlighter = await useHighlighter()

const props = defineProps<{
    code: string
    language: string
    class?: string
    meta?: string
}>()

const computedLanguage = computed(() => {
    switch (props.language) {
        case 'javascript':
            return 'js'
        case 'typescript':
            return 'ts'
        default:
            return props.language
    }
})

const computedCode = computed(() => {
    return props.code.trim().replace(/`+$/, '')
})

const computedKey = computed(() => {
    return `${computedLanguage.value}-${colorMode.value}`
})
</script>

<template>
    <ProsePre v-bind="props">
        <ShikiCachedRenderer
:key="computedKey" :lang="computedLanguage" :code="computedCode" :highlighter="highlighter"
            :theme="colorMode.value === 'dark' ? 'github-dark-default' : 'github-light-default'" />
    </ProsePre>
</template>