<script setup lang="ts">
const head = useLocaleHead()

import { authClient } from "@/lib/auth";

useHead({
  htmlAttrs: {
    ...head.value.htmlAttrs,
  }
})
</script>

<template>
  <AppProvider>
    <NuxtLoadingIndicator />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </AppProvider>
</template>
