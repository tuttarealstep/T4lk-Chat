export default defineEventHandler(async () => {
    // Check which providers have server-side configuration
    const serverConfig = {
        openai: !!process.env.OPENAI_API_KEY,
        anthropic: !!process.env.ANTHROPIC_API_KEY,
        azure: !!(process.env.AZURE_API_KEY && process.env.AZURE_RESOURCE_NAME),
        openrouter: !!process.env.OPENROUTER_API_KEY,
        google: !!process.env.GOOGLE_API_KEY,
        deepseek: !!process.env.DEEPSEEK_API_KEY,
        xai: !!process.env.XAI_API_KEY
    }

    return serverConfig
})
