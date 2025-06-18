import { createOpenAI } from '@ai-sdk/openai';
import { createAzure } from '@ai-sdk/azure';
import { createAnthropic } from '@ai-sdk/anthropic';
import { wrapLanguageModel, extractReasoningMiddleware, generateText, type Message, LanguageModelV1 } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createXai } from '@ai-sdk/xai';

import { titleGeneratorPrompt } from './prompts';
import { LLMs, type LLMInfo, LLM_PROVIDERS, LLM_FEATURES } from '../../../shared/ai/LLM';
import type { ApiKeys } from '#shared/types/api-keys';

export const getLLM = (modelKey: string): LLMInfo => {
    const llm = LLMs[modelKey];

    if (!llm) {
        throw new Error(`Model '${modelKey}' not found in LLM registry`);
    }

    if (llm.disabled) {
        throw new Error(`Model '${modelKey}' is currently disabled`);
    }

    return llm;
}

export const getModelProvider = (modelKey: string): LLM_PROVIDERS => {
    const llm = getLLM(modelKey);
    return llm.provider;
}

// Get the appropriate AI provider based on the model
export const getAIProvider = (modelKey: string, llmInfo: LLMInfo, options?: {
    webSearch?: boolean;
}, userApiKeys?: ApiKeys) => {
    switch (llmInfo.provider) {
        case LLM_PROVIDERS.AZURE: {
            const azureConfig = userApiKeys?.azure;
            let resourceName = process.env.AZURE_RESOURCE_NAME || '';
            let deploymentName = llmInfo.id; // Use the model's ID for Azure deployment
            const apiKey = azureConfig?.apiKey || process.env.AZURE_API_KEY || '';

            // Se l'utente ha configurato deployment specifici per questo modello
            if (azureConfig?.deployments?.[modelKey]) {
                resourceName = azureConfig.deployments[modelKey].resourceName;
                deploymentName = azureConfig.deployments[modelKey].deploymentName || llmInfo.id;
            }

            if (!apiKey || !resourceName) {
                throw new Error(`Azure configuration incomplete: missing ${!apiKey ? 'API key' : 'resource name'}`);
            }

            const azure = createAzure({
                resourceName: resourceName,
                apiKey: apiKey,
            });

            if (llmInfo.features.includes(LLM_FEATURES.REASONING)) {
                return wrapLanguageModel({
                    model: azure(deploymentName),
                    middleware: extractReasoningMiddleware({ tagName: 'think' }),
                });
            }
            return azure(deploymentName);
        }
        case LLM_PROVIDERS.ANTHROPIC: {
            const apiKey = userApiKeys?.anthropic || process.env.ANTHROPIC_API_KEY || '';
            if (!apiKey) {
                throw new Error('Anthropic API key not configured');
            }
            const anthropic = createAnthropic({ apiKey });
            return anthropic(llmInfo.id);
        }
        case LLM_PROVIDERS.OPENAI: {
            const apiKey = userApiKeys?.openai || process.env.OPENAI_API_KEY || '';
            if (!apiKey) {
                throw new Error('OpenAI API key not configured');
            }
            const openai = createOpenAI({ apiKey });

            if (options?.webSearch && llmInfo.features.includes(LLM_FEATURES.SEARCH)) {
                return openai.responses(llmInfo.id);
            } else {
                return openai(llmInfo.id);
            }
        }
        case LLM_PROVIDERS.OPENROUTER: {
            const apiKey = userApiKeys?.openrouter || process.env.OPENROUTER_API_KEY || '';
            if (!apiKey) {
                throw new Error('OpenRouter API key not configured');
            }
            const openrouter = createOpenRouter({ apiKey });
            return openrouter.chat(llmInfo.id);
        }
        case LLM_PROVIDERS.GOOGLE: {
            const apiKey = userApiKeys?.google || process.env.GOOGLE_API_KEY || '';
            if (!apiKey) {
                throw new Error('Google API key not configured');
            }

            const google = createGoogleGenerativeAI({ apiKey });

            return google(llmInfo.id, {
                useSearchGrounding: options?.webSearch || false,
            });
        }
        case LLM_PROVIDERS.DEEPSEEK: {
            const apiKey = userApiKeys?.deepseek || process.env.DEEPSEEK_API_KEY || '';
            if (!apiKey) {
                throw new Error('DeepSeek API key not configured');
            }
            const deepseek = createDeepSeek({ apiKey });
            return deepseek(llmInfo.id);
        }
        case LLM_PROVIDERS.XAI: {
            const apiKey = userApiKeys?.xai || process.env.XAI_API_KEY || '';
            if (!apiKey) {
                throw new Error('xAI API key not configured');
            }
            const xai = createXai({ apiKey });
            return xai(llmInfo.id);
        }
        default:
            throw new Error(`Provider ${llmInfo.provider} is not yet supported`);
    }
};

//todo support different models for different providers
export const generateThreadTitle = async (message: string, userApiKeys?: ApiKeys) => {

    const openrouter = createOpenRouter({
        apiKey: userApiKeys?.openrouter || process.env.TITLE_GENERATOR_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY || '',
    });


    return await generateText({
        model: openrouter.chat('meta-llama/llama-3.3-8b-instruct:free'),
        messages: [{
            role: 'system',
            content: titleGeneratorPrompt
        }, {
            role: 'user',
            content: message.substring(0, 1000) // Limit to first 1000 characters
        }]
    }).then(response => {
        const title = response.text.trim();
        return title.length > 300 ? title.substring(0, 300) : title;
    }).catch(error => {
        console.error("Error generating thread title:", error);
        return message.substring(0, 30); // Fallback to first 30 characters of the message
    });
}

export const getImageProvider = (modelKey: string, llmInfo: LLMInfo, userApiKeys?: ApiKeys) => {
    console.log('getImageProvider called with:', { modelKey, provider: llmInfo.provider, userApiKeys: !!userApiKeys });

    switch (llmInfo.provider) {
        case LLM_PROVIDERS.OPENAI: {
            const apiKey = userApiKeys?.openai || process.env.OPENAI_API_KEY || '';

            if (!apiKey) {
                throw new Error('OpenAI API key not configured');
            }
            const openai = createOpenAI({ apiKey });
            return openai.image(llmInfo.id);
        }
        default:
            throw new Error(`Image generation not supported for provider: ${llmInfo.provider}`);
    }
}