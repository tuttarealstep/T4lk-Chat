<script setup lang="ts">
import { authClient } from "@/lib/auth";

const head = useLocaleHead()

useHead({
  htmlAttrs: {
    ...head.value.htmlAttrs,
  }
})

const { data: session } = await authClient.useSession(useFetch);

if (!session.value) {
  // If no session, redirect to sign-in page
  await authClient.signIn.anonymous();
}
</script>

<template>
  <AppProvider>
    <NuxtLoadingIndicator />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </AppProvider>
</template>
