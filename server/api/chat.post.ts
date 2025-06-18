import { auth } from "../lib/auth";
import { ChatRequestSchema } from "../utils/schemas";
import { getAIProvider, getLLM } from "../utils/ai/utils";
import { createDataStreamResponse, type Message } from "ai";
import { LLM_FEATURES, type LLMInfo } from "#shared/ai/LLM";
import { handleThreadCreation, updateThreadStatus } from "../utils/chat/thread-manager";
import { saveMessagesToDatabase } from "../utils/chat/message-manager";
import { processAttachments, convertAttachmentsToMessageContent } from "../utils/chat/attachment-processor";
import { handleImageGeneration } from "../utils/chat/image-generator";
import { handleTextGeneration } from "../utils/chat/text-generator";
import { updateUserLastSelectedModel } from "../utils/chat/user-preferences";


export default defineEventHandler(async (event) => {
    try {
        const session = await auth.api.getSession({
            headers: event.headers
        });

        if (!session) {
            setResponseStatus(event, 401);
            return { error: "Unauthorized" };
        }

        // Validate request body
        const body = await readBody(event);
        const validationResult = ChatRequestSchema.safeParse(body);

        // Check if validation was successful
        if (!validationResult.success) {
            setResponseStatus(event, 400);
            return { error: "Invalid request body", details: validationResult.error.issues };
        }

        // Handle connection close event
        const controller = new AbortController();
        event.node.res.on('close', () => {
            controller.abort();
        });

        const { messages, threadMetadata, model, modelParams, preferences, userInfo, apiKeys, attachmentIds } = validationResult.data;
        const userId = session.user.id;

        // Extract web search setting
        const webSearchEnabled = modelParams?.webSearch || false;

        // Validate and get LLM info
        let llmInfo: LLMInfo;
        try {
            llmInfo = getLLM(model);
        } catch (error) {
            setResponseStatus(event, 400);
            return { error: `Invalid model: ${error instanceof Error ? error.message : 'Unknown error'}` };
        }

        // Check that messages are only from the user or assistant
        for (const message of messages) {
            if (message.role !== 'user' && message.role !== 'assistant') {
                setResponseStatus(event, 400);
                return { error: "Messages must be from the user or assistant" };
            }
        }

        // Handle thread creation or validation
        const firstTextMessage = messages.find(msg => msg.parts?.some(part => part.type === 'text'));
        const { threadId, thread } = await handleThreadCreation({
            userId,
            threadMetadata,
            firstMessage: firstTextMessage,
            apiKeys
        });

        const lastMessage: Message | undefined = messages[messages.length - 1]
        if (!lastMessage) {
            setResponseStatus(event, 400);
            return { error: "No messages provided" };
        }

        // Ensure the last message is a user message with content or attachments
        if (!lastMessage || !lastMessage.parts || lastMessage.parts.length === 0 || lastMessage.role !== 'user') {
            setResponseStatus(event, 400);
            return { error: "Last message must be a user message with content" };
        }

        // Check if message has text content or attachments are provided
        const hasTextContent = lastMessage.parts.some(part => part.type === 'text' && part.text?.trim());
        const hasAttachments = attachmentIds && attachmentIds.length > 0;

        if (!hasTextContent && !hasAttachments) {
            setResponseStatus(event, 400);
            return { error: "Message must contain either text content or attachments" };
        }

        // Save messages to database
        const { messageIdForGeneration } = await saveMessagesToDatabase({
            threadId,
            messages,
            model,
            attachmentIds
        });

        // Update thread and user preferences
        await updateThreadStatus(threadId, 'generating');
        await updateUserLastSelectedModel(userId, model);

        // Get the ID of the last user message that will need generation
        const messageId = messageIdForGeneration || lastMessage.id;

        if (!messageId) {
            setResponseStatus(event, 500);
            return { error: "Failed to get message ID for generation" };
        }

        let aiProvider;
        try {
            aiProvider = getAIProvider(model, llmInfo, {
                webSearch: webSearchEnabled,
            }, apiKeys);
        } catch (error) {
            setResponseStatus(event, 400);
            return { error: `Unsupported provider: ${error instanceof Error ? error.message : 'Unknown error'}` };
        }

        return createDataStreamResponse({
            execute: async (dataStream) => {
                dataStream.writeData({
                    threadId: threadId,
                });

                const generationStartAt = Date.now();
                // Build provider options based on model and params
                const providerOptions: Record<string, Record<string, unknown>> = {}

                if (modelParams?.openai && llmInfo.provider === 'openai') {
                    providerOptions.openai = {}
                    if (modelParams.openai.reasoningEffort) {
                        providerOptions.openai.reasoningEffort = modelParams.openai.reasoningEffort
                    }
                }

                if (modelParams?.anthropic && llmInfo.provider === 'anthropic') {
                    providerOptions.anthropic = {}
                    if (modelParams.anthropic.thinking) {
                        providerOptions.anthropic.thinking = {
                            type: modelParams.anthropic.thinking.type || 'enabled'
                        }
                        if (modelParams.anthropic.thinking.budgetTokens) {
                            (providerOptions.anthropic as any).thinking.budgetTokens = modelParams.anthropic.thinking.budgetTokens
                        }
                    }
                }

                if (modelParams?.google && llmInfo.provider === 'google') {
                    providerOptions.google = {
                        thinkingConfig: {}
                    }
                    if (modelParams.google.includeThoughts !== undefined) {
                        (providerOptions.google as any).thinkingConfig.includeThoughts = modelParams.google.includeThoughts
                    }
                    if (modelParams.google.thinkingBudget) {
                        (providerOptions.google as any).thinkingConfig.thinkingBudget = modelParams.google.thinkingBudget
                    }
                }

                if (modelParams?.openrouter && llmInfo.provider === 'openrouter') {
                    providerOptions.openrouter = {}
                    if (modelParams.openrouter.reasoning) {
                        providerOptions.openrouter.reasoning = {}

                        // Handle max_tokens for Anthropic and Gemini thinking models
                        if (modelParams.openrouter.reasoning.max_tokens) {
                            (providerOptions.openrouter as any).reasoning.max_tokens = modelParams.openrouter.reasoning.max_tokens
                        }

                        // Handle effort level for OpenAI o-series and Grok models
                        if (modelParams.openrouter.reasoning.effort) {
                            (providerOptions.openrouter as any).reasoning.effort = modelParams.openrouter.reasoning.effort
                        }
                    }
                }

                // Handle attachments from request
                const processed_attachments = await processAttachments(attachmentIds || []);

                const parsedMessages = messages.map((msg) => {
                    const textParts = msg.parts?.filter(part => part.type === 'text' && typeof part.text === 'string') || [];
                    const hasAttachments = processed_attachments && processed_attachments.length > 0;

                    return {
                        ...msg,
                        role: msg.role,
                        content: [
                            ...(textParts.filter(part => part.text.trim() || !hasAttachments).map(part => ({
                                type: 'text' as const,
                                text: part.text
                            }))),
                            ...convertAttachmentsToMessageContent(processed_attachments)
                        ]
                    } as unknown as Message;
                });

                // Check if it's an image generation request
                const isImageGeneration = llmInfo.features.includes(LLM_FEATURES.IMAGES);

                if (isImageGeneration) {
                    await handleImageGeneration({
                        messages,
                        model,
                        llmInfo,
                        apiKeys,
                        messageId,
                        threadId,
                        modelParams,
                        dataStream
                    });
                } else {
                    handleTextGeneration({
                        aiProvider,
                        llmInfo,
                        messages: parsedMessages,
                        preferences,
                        userInfo,
                        providerOptions,
                        webSearchEnabled,
                        controller,
                        messageId,
                        threadId,
                        model,
                        dataStream
                    });
                }
            },
            onError: (error: unknown) => {
                //TODO - THIS IS NOT GOOD FOR PRODUCTION
                //https://ai-sdk.dev/docs/troubleshooting/use-chat-an-error-occurred
                if (error == null) {
                    return 'unknown error';
                }

                if (typeof error === 'string') {
                    return error;
                }

                if (error instanceof Error) {
                    return error.message;
                }

                return JSON.stringify(error);
            },
        })

    } catch (error) {
        console.error("Error in chat endpoint:", error);
        setResponseStatus(event, 500);
        return { error: "Internal server error" };
    }
});