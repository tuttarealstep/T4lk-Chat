import { createAuthClient } from "better-auth/vue"
import { anonymousClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
    plugins: [
        anonymousClient()
    ]
})