import type { ChunkDetector } from "ai";

export enum LLM_FEATURES {
    FAST = 'fast',
    VISION = 'vision',
    IMAGES = 'images',
    SEARCH = 'search',
    PDFS = 'pdfs',
    PARAMETERS = 'parameters',
    REASONING = 'reasoning',
    REASONING_EFFORT = 'reasoningEffort',
}

export enum LLM_PROVIDERS {
    AZURE = 'azure',
    ANTHROPIC = 'anthropic',
    OPENAI = 'openai',
    OPENROUTER = 'openrouter',
    GOOGLE = 'google',
    DEEPSEEK = 'deepseek',
    XAI = 'xai',
}

export interface LLMInfo {
    id: string;
    name: string;
    version?: string;
    additionalInfo?: string;
    provider: LLM_PROVIDERS;
    developer: string;
    disabled: boolean;
    limits: {
        maxInputTokens: number;
        maxOutputTokens: number;
    };
    features: LLM_FEATURES[];
    experimental: boolean;
    streamChunking?: 'word' | 'line' | RegExp | ChunkDetector
    statuspage?: {
        url: string;
        apiUrl?: string;
    };
}

export const LLMs: Record<string, LLMInfo> = {
    /*"gpt-4o-mini-azure": {
        id: "gpt-4o-mini",
        name: "GPT-4o Mini",
        version: "4o Mini",
        provider: LLM_PROVIDERS.AZURE,
        developer: "OpenAI",
        disabled: false,
        limits: {
            maxInputTokens: 128_000,
            maxOutputTokens: 16_384
        },
        features: [LLM_FEATURES.VISION, LLM_FEATURES.PARAMETERS],
        experimental: false
    },
    "gpt-4o-azure": {
        id: "gpt-4o-azure",
        name: "GPT-4o",
        version: "4o",
        provider: LLM_PROVIDERS.AZURE,
        developer: "OpenAI",
        disabled: false,
        limits: {
            maxInputTokens: 128_000,
            maxOutputTokens: 16_384
        },
        features: [LLM_FEATURES.VISION, LLM_FEATURES.PARAMETERS],
        experimental: false
    },
     "gpt-4.1-azure": {
         id: "gpt-4.1-azure",
         name: "GPT-4.1",
         version: "4.1",
         provider: LLM_PROVIDERS.AZURE,
         developer: "OpenAI",
         disabled: false,
         limits: {
             maxInputTokens: 1_000_000,
             maxOutputTokens: 16_384
         },
         features: [LLM_FEATURES.VISION, LLM_FEATURES.PARAMETERS],
         experimental: false,
         streamChunking: "word"
     },
     "gpt-4.1-mini-azure": {
         id: "gpt-4.1-mini-azure",
         name: "GPT-4.1 Mini",
         version: "4.1 Mini",
         provider: LLM_PROVIDERS.AZURE,
         developer: "OpenAI",
         disabled: false,
         limits: {
             maxInputTokens: 1_000_000,
             maxOutputTokens: 16_384
         },
         features: [LLM_FEATURES.VISION, LLM_FEATURES.PARAMETERS],
         experimental: false,
         streamChunking: "word"
     },
     "gpt-4.1-nano-azure": {
         id: "gpt-4.1-nano-azure",
         name: "GPT-4.1 Nano",
         version: "4.1 Nano",
         provider: LLM_PROVIDERS.AZURE,
         developer: "OpenAI",
         disabled: false,
         limits: {
             maxInputTokens: 1_000_000,
             maxOutputTokens: 16_384
         },
         features: [LLM_FEATURES.VISION, LLM_FEATURES.PARAMETERS],
         experimental: false,
         streamChunking: "word"
     },*/
    "gpt-4o-mini": {
        id: "gpt-4o-mini",
        name: "GPT-4o Mini",
        version: "4o Mini",
        provider: LLM_PROVIDERS.OPENAI,
        developer: "OpenAI",
        disabled: false,
        limits: {
            maxInputTokens: 128_000,
            maxOutputTokens: 16_384
        },
        features: [LLM_FEATURES.VISION, LLM_FEATURES.PARAMETERS, LLM_FEATURES.PDFS, LLM_FEATURES.SEARCH],
        experimental: false
    },
    "gpt-4o": {
        id: "gpt-4o",
        name: "GPT-4o",
        version: "4o",
        provider: LLM_PROVIDERS.OPENAI,
        developer: "OpenAI",
        disabled: false,
        limits: {
            maxInputTokens: 128_000,
            maxOutputTokens: 16_384
        },
        features: [LLM_FEATURES.VISION, LLM_FEATURES.PARAMETERS, LLM_FEATURES.PDFS, LLM_FEATURES.SEARCH],
        experimental: false
    },
    "o3-mini": {
        id: "o3-mini",
        name: "o3 Mini",
        version: "",
        provider: LLM_PROVIDERS.OPENAI,
        developer: "OpenAI",
        disabled: false,
        limits: {
            maxInputTokens: 200_000,
            maxOutputTokens: 100_000
        },
        features: [LLM_FEATURES.PARAMETERS, LLM_FEATURES.REASONING, LLM_FEATURES.REASONING_EFFORT, LLM_FEATURES.SEARCH],
        experimental: false
    },
    "o4-mini": {
        id: "o4-mini",
        name: "o4 Mini",
        version: "",
        provider: LLM_PROVIDERS.OPENAI,
        developer: "OpenAI",
        disabled: false,
        limits: {
            maxInputTokens: 200_000,
            maxOutputTokens: 100_000
        },
        features: [LLM_FEATURES.PARAMETERS, LLM_FEATURES.REASONING, LLM_FEATURES.REASONING_EFFORT, LLM_FEATURES.VISION, LLM_FEATURES.PDFS, LLM_FEATURES.SEARCH],
        experimental: false
    },
    "gpt-4.5": {
        id: "gpt-4.5",
        name: "GPT-4.5",
        version: "4.5",
        provider: LLM_PROVIDERS.OPENAI,
        developer: "OpenAI",
        disabled: false,
        limits: {
            maxInputTokens: 200_000,
            maxOutputTokens: 16_384
        },
        features: [LLM_FEATURES.VISION, LLM_FEATURES.PARAMETERS, LLM_FEATURES.SEARCH],
        experimental: false
    },
    "gpt-4.1": {
        id: "gpt-4.1",
        name: "GPT-4.1",
        version: "4.1",
        provider: LLM_PROVIDERS.OPENAI,
        developer: "OpenAI",
        disabled: false,
        limits: {
            maxInputTokens: 1_000_000,
            maxOutputTokens: 16_384
        },
        features: [LLM_FEATURES.VISION, LLM_FEATURES.PARAMETERS, LLM_FEATURES.SEARCH],
        experimental: false,
        streamChunking: "word"
    },
    "gpt-4.1-mini": {
        id: "gpt-4.1-mini",
        name: "GPT-4.1 Mini",
        version: "4.1 Mini",
        provider: LLM_PROVIDERS.OPENAI,
        developer: "OpenAI",
        disabled: false,
        limits: {
            maxInputTokens: 1_000_000,
            maxOutputTokens: 16_384
        },
        features: [LLM_FEATURES.VISION, LLM_FEATURES.PARAMETERS, LLM_FEATURES.SEARCH],
        experimental: false,
        streamChunking: "word"
    },
    "gpt-4.1-nano": {
        id: "gpt-4.1-nano",
        name: "GPT-4.1 Nano",
        version: "4.1 Nano",
        provider: LLM_PROVIDERS.OPENAI,
        developer: "OpenAI",
        disabled: false,
        limits: {
            maxInputTokens: 1_000_000,
            maxOutputTokens: 16_384
        },
        features: [LLM_FEATURES.VISION, LLM_FEATURES.PARAMETERS, LLM_FEATURES.SEARCH],
        experimental: false,
        streamChunking: "word"
    },
    "gpt-image-1": {
        id: "gpt-image-1",
        name: "GPT ImageGen",
        version: "1",
        provider: LLM_PROVIDERS.OPENAI,
        developer: "OpenAI",
        disabled: false,
        limits: {
            maxInputTokens: 10_000,
            maxOutputTokens: 16_384
        },
        features: [LLM_FEATURES.IMAGES],
        experimental: true,
    },
    "o3-pro": {
        id: "o3-pro",
        name: "o3 Pro",
        version: "Pro",
        provider: LLM_PROVIDERS.OPENAI,
        developer: "OpenAI",
        disabled: false,
        limits: {
            maxInputTokens: 200_000,
            maxOutputTokens: 100_000
        },
        features: [LLM_FEATURES.VISION, LLM_FEATURES.PARAMETERS, LLM_FEATURES.REASONING_EFFORT, LLM_FEATURES.REASONING, LLM_FEATURES.PDFS],
        experimental: false,
    },
    "o3-full": {
        id: "o3-full",
        name: "o3 Full",
        version: "Full",
        provider: LLM_PROVIDERS.OPENAI,
        developer: "OpenAI",
        disabled: false,
        limits: {
            maxInputTokens: 200_000,
            maxOutputTokens: 100_000
        },
        features: [LLM_FEATURES.VISION, LLM_FEATURES.PARAMETERS, LLM_FEATURES.REASONING_EFFORT, LLM_FEATURES.REASONING, LLM_FEATURES.PDFS],
        experimental: false,
    },
    "claude-3.5": {
        id: "claude-3.5",
        name: "Claude 3.5 Sonnet",
        version: "3.5",
        provider: LLM_PROVIDERS.ANTHROPIC,
        developer: "Anthropic",
        disabled: false,
        limits: {
            maxInputTokens: 30_000,
            maxOutputTokens: 16_384
        },
        features: [LLM_FEATURES.VISION, LLM_FEATURES.PDFS, LLM_FEATURES.PARAMETERS],
        statuspage: {
            url: "https://status.anthropic.com",
            apiUrl: "https://status.anthropic.com/api/v2/status.json"
        },
        experimental: false
    },
    "claude-3.7": {
        id: "claude-3.7",
        name: "Claude 3.7 Sonnet",
        version: "3.7",
        provider: LLM_PROVIDERS.ANTHROPIC,
        developer: "Anthropic",
        disabled: false,
        limits: {
            maxInputTokens: 30_000,
            maxOutputTokens: 16_384
        },
        features: [LLM_FEATURES.VISION, LLM_FEATURES.PDFS, LLM_FEATURES.PARAMETERS, LLM_FEATURES.REASONING, LLM_FEATURES.REASONING_EFFORT],
        statuspage: {
            url: "https://status.anthropic.com",
            apiUrl: "https://status.anthropic.com/api/v2/status.json"
        },
        experimental: false
    },
    "claude-4-sonnet": {
        id: "claude-4-sonnet",
        name: "Claude 4 Sonnet",
        version: "4 Sonnet",
        provider: LLM_PROVIDERS.ANTHROPIC,
        developer: "Anthropic",
        disabled: false,
        limits: {
            maxInputTokens: 30_000,
            maxOutputTokens: 16_384
        },
        features: [LLM_FEATURES.VISION, LLM_FEATURES.PDFS, LLM_FEATURES.PARAMETERS, LLM_FEATURES.REASONING, LLM_FEATURES.REASONING_EFFORT],
        statuspage: {
            url: "https://status.anthropic.com",
            apiUrl: "https://status.anthropic.com/api/v2/status.json"
        },
        experimental: false
    },
    "claude-4-opus": {
        id: "claude-4-opus",
        name: "Claude 4 Opus",
        version: "4 Opus",
        provider: LLM_PROVIDERS.ANTHROPIC,
        developer: "Anthropic",
        disabled: false,
        limits: {
            maxInputTokens: 30_000,
            maxOutputTokens: 15_000
        },
        features: [LLM_FEATURES.VISION, LLM_FEATURES.PDFS, LLM_FEATURES.PARAMETERS, LLM_FEATURES.REASONING, LLM_FEATURES.REASONING_EFFORT],
        statuspage: {
            url: "https://status.anthropic.com",
            apiUrl: "https://status.anthropic.com/api/v2/status.json"
        },
        experimental: false
    },
    "deepseek-r1-openrouter": {
        id: "deepseek/deepseek-r1",
        name: "DeepSeek R1",
        version: "R1",
        additionalInfo: "OpenRouter",
        provider: LLM_PROVIDERS.OPENROUTER,
        developer: "DeepSeek",
        disabled: false,
        limits: {
            maxInputTokens: 128_000,
            maxOutputTokens: 16_384
        },
        features: [LLM_FEATURES.PARAMETERS, LLM_FEATURES.REASONING],
        experimental: true
    },
    "deepseek-r1-0528-openrouter": {
        id: "deepseek/deepseek-r1-0528",
        name: "DeepSeek R1",
        version: "R1 0528",
        additionalInfo: "OpenRouter",
        provider: LLM_PROVIDERS.OPENROUTER,
        developer: "DeepSeek",
        disabled: false,
        limits: {
            maxInputTokens: 128_000,
            maxOutputTokens: 16_384
        },
        features: [LLM_FEATURES.PARAMETERS, LLM_FEATURES.REASONING],
        experimental: true
    },
    "deepseek-chat-v3-0324-openrouter": {
        id: "deepseek/deepseek-chat-v3-0324",
        name: "DeepSeek v3",
        version: "chat v3 0324",
        additionalInfo: "OpenRouter",
        provider: LLM_PROVIDERS.OPENROUTER,
        developer: "DeepSeek",
        disabled: false,
        features: [LLM_FEATURES.PARAMETERS],
        limits: {
            maxInputTokens: 64_000,
            maxOutputTokens: 16_384
        },
        experimental: true
    },
    "llama-4-maverick-openrouter": {
        id: "meta-llama/llama-4-maverick",
        name: "Llama 4 Maverick",
        version: "4 Maverick",
        additionalInfo: "OpenRouter",
        provider: LLM_PROVIDERS.OPENROUTER,
        developer: "Meta",
        disabled: false,
        limits: {
            maxInputTokens: 1_000_000,
            maxOutputTokens: 512_000
        },
        features: [LLM_FEATURES.PARAMETERS, LLM_FEATURES.VISION],
        experimental: true
    },
    "grok-3-beta-openrouter": {
        id: "x-ai/grok-3-beta",
        name: "Grok 3 Beta",
        version: "3 Beta",
        additionalInfo: "OpenRouter",
        provider: LLM_PROVIDERS.OPENROUTER,
        developer: "xAI",
        disabled: false,
        limits: {
            maxInputTokens: 128_000,
            maxOutputTokens: 8_192
        },
        features: [LLM_FEATURES.PARAMETERS, LLM_FEATURES.REASONING, LLM_FEATURES.REASONING_EFFORT],
        experimental: true
    },
    "grok-3-mini-openrouter": {
        id: "x-ai/grok-3-mini-beta",
        name: "Grok 3 Mini",
        version: "3 Mini",
        additionalInfo: "OpenRouter",
        provider: LLM_PROVIDERS.OPENROUTER,
        developer: "xAI",
        disabled: false,
        limits: {
            maxInputTokens: 128_000,
            maxOutputTokens: 8_192
        },
        features: [LLM_FEATURES.PARAMETERS, LLM_FEATURES.REASONING, LLM_FEATURES.REASONING_EFFORT],
        experimental: true
    },
    "deepseek-r1:free-openrouter": {
        id: "deepseek/deepseek-r1-0528:free",
        name: "DeepSeek R1",
        version: "0528 Free",
        additionalInfo: "OpenRouter",
        provider: LLM_PROVIDERS.OPENROUTER,
        developer: "DeepSeek",
        disabled: false,
        limits: {
            maxInputTokens: 128_000,
            maxOutputTokens: 16_384
        },
        features: [LLM_FEATURES.PARAMETERS, LLM_FEATURES.REASONING],
        experimental: false
    },
    "gemini-2.0-flash": {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        version: "2.0 Flash",
        provider: LLM_PROVIDERS.GOOGLE,
        developer: "Google",
        disabled: false,
        limits: {
            maxInputTokens: 1_048_576,
            maxOutputTokens: 8_192
        },
        features: [LLM_FEATURES.VISION, LLM_FEATURES.PDFS, LLM_FEATURES.SEARCH],
        experimental: false,
        streamChunking: "word"
    },
    "gemini-2.5-flash-preview-05-20": {
        id: "gemini-2.5-flash-preview-05-20",
        name: "Gemini 2.5 Flash Preview",
        version: "2.5 Flash Preview",
        provider: LLM_PROVIDERS.GOOGLE,
        developer: "Google",
        disabled: false,
        limits: {
            maxInputTokens: 1_048_576,
            maxOutputTokens: 65_536
        },
        features: [LLM_FEATURES.VISION, LLM_FEATURES.PDFS, LLM_FEATURES.SEARCH, LLM_FEATURES.REASONING, LLM_FEATURES.REASONING_EFFORT],
        experimental: false,
        streamChunking: "word"
    },
    "gemini-2.5-pro-preview-06-05": {
        id: "gemini-2.5-pro-preview-06-05",
        name: "Gemini 2.5 Pro Preview",
        version: "2.5 Pro Preview",
        additionalInfo: "06-05",
        provider: LLM_PROVIDERS.GOOGLE,
        developer: "Google",
        disabled: false,
        limits: {
            maxInputTokens: 1_048_576,
            maxOutputTokens: 65_536
        },
        features: [LLM_FEATURES.PARAMETERS, LLM_FEATURES.VISION, LLM_FEATURES.PDFS, LLM_FEATURES.SEARCH, LLM_FEATURES.REASONING, LLM_FEATURES.REASONING_EFFORT],
        experimental: false,
        streamChunking: "word"
    },
    "gpt-4o-mini-openrouter": {
        id: "openai/gpt-4o-mini",
        name: "GPT-4o Mini",
        version: "4o Mini",
        provider: LLM_PROVIDERS.OPENROUTER,
        developer: "OpenAI",
        disabled: false,
        limits: {
            maxInputTokens: 128_000,
            maxOutputTokens: 16_384
        },
        features: [LLM_FEATURES.VISION, LLM_FEATURES.PARAMETERS, LLM_FEATURES.PDFS, LLM_FEATURES.SEARCH],
        experimental: false
    },
    "gpt-4o-openrouter": {
        id: "openai/gpt-4o",
        name: "GPT-4o",
        version: "4o",
        provider: LLM_PROVIDERS.OPENROUTER,
        developer: "OpenAI",
        disabled: false,
        limits: {
            maxInputTokens: 128_000,
            maxOutputTokens: 16_384
        },
        features: [LLM_FEATURES.VISION, LLM_FEATURES.PARAMETERS, LLM_FEATURES.PDFS, LLM_FEATURES.SEARCH],
        experimental: false
    },
    "o3-mini-openrouter": {
        id: "openai/o3-mini",
        name: "o3 Mini",
        version: "",
        provider: LLM_PROVIDERS.OPENROUTER,
        developer: "OpenAI",
        disabled: false,
        limits: {
            maxInputTokens: 200_000,
            maxOutputTokens: 100_000
        },
        features: [LLM_FEATURES.PARAMETERS, LLM_FEATURES.REASONING, LLM_FEATURES.REASONING_EFFORT, LLM_FEATURES.SEARCH],
        experimental: false
    },
    "o4-mini-openrouter": {
        id: "openai/o4-mini",
        name: "o4 Mini",
        version: "",
        provider: LLM_PROVIDERS.OPENROUTER,
        developer: "OpenAI",
        disabled: false,
        limits: {
            maxInputTokens: 200_000,
            maxOutputTokens: 100_000
        },
        features: [LLM_FEATURES.PARAMETERS, LLM_FEATURES.REASONING, LLM_FEATURES.REASONING_EFFORT, LLM_FEATURES.VISION, LLM_FEATURES.PDFS, LLM_FEATURES.SEARCH],
        experimental: false
    },
    "gpt-4.1-openrouter": {
        id: "openai/gpt-4.1",
        name: "GPT-4.1",
        version: "4.1",
        provider: LLM_PROVIDERS.OPENROUTER,
        developer: "OpenAI",
        disabled: false,
        limits: {
            maxInputTokens: 1_000_000,
            maxOutputTokens: 16_384
        },
        features: [LLM_FEATURES.VISION, LLM_FEATURES.PARAMETERS, LLM_FEATURES.SEARCH],
        experimental: false,
        streamChunking: "word"
    },
    "gpt-4.1-mini-openrouter": {
        id: "openai/gpt-4.1-mini",
        name: "GPT-4.1 Mini",
        version: "4.1 Mini",
        provider: LLM_PROVIDERS.OPENROUTER,
        developer: "OpenAI",
        disabled: false,
        limits: {
            maxInputTokens: 1_000_000,
            maxOutputTokens: 16_384
        },
        features: [LLM_FEATURES.VISION, LLM_FEATURES.PARAMETERS, LLM_FEATURES.SEARCH],
        experimental: false,
        streamChunking: "word"
    },
    "gpt-4.1-nano-openrouter": {
        id: "openai/gpt-4.1-nano",
        name: "GPT-4.1 Nano",
        version: "4.1 Nano",
        provider: LLM_PROVIDERS.OPENROUTER,
        developer: "OpenAI",
        disabled: false,
        limits: {
            maxInputTokens: 1_000_000,
            maxOutputTokens: 16_384
        },
        features: [LLM_FEATURES.VISION, LLM_FEATURES.PARAMETERS, LLM_FEATURES.SEARCH],
        experimental: false,
        streamChunking: "word"
    }
}

export const defaultLLM = "gpt-4.1-mini";