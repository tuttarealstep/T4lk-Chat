import { authClient } from "@/lib/auth";
export default defineNuxtRouteMiddleware(async (to) => {
    const { data: session } = await authClient.useSession(useFetch);
    if (!session.value || !session.value.user || session.value.user.isAnonymous) {
        if (to.path !== "/auth") {
            return navigateTo("/auth");
        }
    }
});