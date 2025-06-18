<script setup lang="ts">
import { authClient } from "@/lib/auth";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

definePageMeta({
    middleware: ['guest'],
})

const { data: session } = await authClient.useSession(useFetch);

if (!session.value) {
    // If no session, redirect to sign-in page
    await authClient.signIn.anonymous();
}

//todo Terms and Privacy Policy links
</script>

<template>
    <div class="flex min-h-screen flex-col items-center justify-center p-8 z-10">
        <div class="flex flex-col gap-6">
            <Card>
                <CardHeader class="text-center">
                    <CardTitle class="text-xl">
                        {{ $t('auth.welcome_to_t4lk') }}
                    </CardTitle>
                    <CardDescription>
                        {{ $t('auth.login_description') }}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form>
                        <div class="grid gap-6">
                            <div class="flex flex-col gap-4">
                                <Button type="button" variant="outline" class="w-full cursor-pointer" @click="() => authClient.signIn.social({
                                    provider: 'github'
                                })">
                                    <Icon name="lucide:github" class="!size-4" />
                                    {{ $t('auth.continue_with_github') }}
                                </Button>
                            </div>
                        </div>
                    </form>
                </CardContent>
            </Card>
            <div
                class="text-balance text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 [&_a]:hover:text-primary">
                {{ $t('auth.terms_privacy_text') }} <a href="#">{{ $t('auth.terms_of_service') }}</a>
                {{ $t('and') }} <a href="#">{{ $t('auth.privacy_policy') }}</a>.
            </div>
        </div>
    </div>
</template>