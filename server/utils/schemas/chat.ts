import { z } from "zod";
import type { Message } from "ai";
import { ApiKeys } from "~~/shared/types/api-keys";

// Thread metadata schemas
export const ThreadMetadataSchema = z.object({
    id: z.string().uuid().optional()
});

// Image generation schemas
export const ImageGenParamsSchema = z.object({
    n: z.number().min(1).max(10).optional().default(1),
    size: z.enum(['1024x1024', '1536x1024', '1024x1536', 'auto']).optional().default('1024x1024'),
    openai: z.object({
        quality: z.enum(['auto', 'high', 'medium', 'low']).optional().default('auto'),
        background: z.enum(['auto', 'transparent', 'opaque']).optional().default('auto'),
        output_format: z.enum(['png', 'jpeg', 'webp']).optional().default('png'),
        output_compression: z.number().min(0).max(100).optional().default(100),
        moderation: z.enum(['auto', 'low']).optional().default('auto')
    }).optional()
});

// Model schemas
export const ModelParamsSchema = z.object({
    webSearch: z.boolean().optional(),
    imageGeneration: ImageGenParamsSchema.optional(),
    openai: z.object({
        reasoningEffort: z.enum(["low", "medium", "high"]).optional()
    }).optional(),
    anthropic: z.object({
        thinking: z.object({
            type: z.enum(["enabled"]).optional(),
            budgetTokens: z.number().min(1000).max(50000).optional()
        }).optional()
    }).optional(),
    google: z.object({
        includeThoughts: z.boolean().optional(),
        thinkingBudget: z.number().min(512).max(32768).optional()
    }).optional(),
    openrouter: z.object({
        reasoning: z.object({
            max_tokens: z.number().min(1).max(100000).optional(),
            effort: z.enum(["low", "medium", "high"]).optional()
        }).optional()
    }).optional()
});

// User schemas
export const PreferencesSchema = z.object({
    name: z.string().default(""),
    occupation: z.string().default(""),
    selectedTraits: z.array(z.string()).default([]),
    additionalInfo: z.string().default(""),
    statsForNerds: z.boolean().default(false)
});

export const UserInfoSchema = z.object({
    timezone: z.string()
});

// Main chat request schema
export const ChatRequestSchema = z.object({
    messages: z.array(z.custom<Message>()),
    threadMetadata: ThreadMetadataSchema,
    model: z.string(),
    modelParams: ModelParamsSchema.optional(),
    preferences: PreferencesSchema,
    userInfo: UserInfoSchema,
    apiKeys: z.custom<ApiKeys>(),
    attachmentIds: z.array(z.string()).optional(),
});
