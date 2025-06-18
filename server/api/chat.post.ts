import { auth } from "../lib/auth";
import { useDrizzle, schema } from "../database";
import { eq, and, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { ChatRequestSchema } from "../utils/schemas";
import { linkAttachmentsToMessage } from '../utils/attachments';
import { generateThreadTitle, getAIProvider, getLLM, getImageProvider } from "../utils/ai/utils";
import { createDataStreamResponse, type Message, smoothStream, streamText, type ToolChoice, type ToolSet, experimental_generateImage as generateImage } from "ai";
import { chatSystemPrompt } from "../utils/ai/prompts";
import { LLM_FEATURES, LLM_PROVIDERS, type LLMInfo } from "#shared/ai/LLM";
import { openai } from "@ai-sdk/openai";

// Helper function to safely extract text from message parts
function getTextFromParts(parts: Array<any> | null | undefined): string {
    if (!parts || !Array.isArray(parts) || parts.length === 0) {
        return '';
    }

    const textPart = parts.find((part) => part?.type === 'text' && typeof part.text === 'string');
    return textPart?.text || '';
}

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
        let threadId = threadMetadata.id;
        let thread: typeof schema.threads.$inferInsert | null = null;

        if (threadId) {
            // Check if thread exists and belongs to the user
            const existingThread = await useDrizzle().select()
                .from(schema.threads)
                .where(and(
                    eq(schema.threads.id, threadId),
                    eq(schema.threads.userId, userId)
                ))
                .get();

            if (!existingThread) {
                // Thread doesn't exist or doesn't belong to user, create new one
                threadId = randomUUID();
                thread = await useDrizzle().insert(schema.threads)
                    .values({
                        id: threadId,
                        userId: userId,
                        generationStatus: 'pending'
                    })
                    .returning()
                    .get();
            } else {
                thread = existingThread;
            }
        } else {
            // Create new thread
            threadId = randomUUID();
            thread = await useDrizzle().insert(schema.threads)
                .values({
                    id: threadId,
                    userId: userId,
                    generationStatus: 'pending'
                })
                .returning()
                .get();
        }

        // Make thread title
        if (!thread.title) {
            // Search if we have a text message to generate a title from
            const firstTextMessage = messages.find(msg => msg.parts?.some(part => part.type === 'text'));

            // If we have a text message, generate a title
            if (firstTextMessage && firstTextMessage.parts && firstTextMessage.parts.length > 0 && firstTextMessage.parts.some(part => part.type === 'text')) {
                const title = await generateThreadTitle(firstTextMessage.parts.find(part => part.type === 'text')?.text || "", apiKeys);

                // Update thread title
                await useDrizzle().update(schema.threads)
                    .set({
                        title: title,
                        userSetTitle: false,
                        updatedAt: new Date()
                    })
                    .where(eq(schema.threads.id, threadId))
                    .execute();

                thread.title = title;
            }
        } const lastMessage: Message | undefined = messages[messages.length - 1]
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
        }        // Salva attachmentIds su message_attachments dopo aver creato il messaggio utente
        let lastUserMessageId: string | undefined;
        let messageIdForGeneration: string | undefined;

        if (threadId) {
            // Get existing messages from database
            const existingMessages = await useDrizzle().select()
                .from(schema.messages)
                .where(eq(schema.messages.threadId, threadId))
                .orderBy(schema.messages.createdAt)
                .all();

            // Detect if this is an edit/retry operation
            let editDetected = false;
            let editStartIndex = -1;

            // Check for retry: if we have fewer incoming messages than existing messages
            // and the last incoming message matches an existing message (retry scenario)
            if (messages.length > 0 && messages.length <= existingMessages.length) {
                const lastIncomingMsg = messages[messages.length - 1];

                // Check if the last incoming message is duplicating an existing user message
                if (lastIncomingMsg.role === 'user' && messages.length <= existingMessages.length) {
                    for (let i = 0; i < existingMessages.length; i++) {
                        const existingMsg = existingMessages[i];
                        if (existingMsg.role === 'user') {
                            const incomingContent = getTextFromParts(lastIncomingMsg.parts);
                            const existingContent = getTextFromParts(existingMsg.parts);

                            if (incomingContent === existingContent && i < existingMessages.length - 1) {
                                // Found matching user message and there are messages after it - this is a retry
                                editDetected = true;
                                editStartIndex = i + 1; // Delete from after the matching user message
                                break;
                            }
                        }
                    }
                }
            }

            if (!editDetected) {
                // Check for edit: compare messages to find where they diverge
                for (let i = 0; i < Math.min(messages.length, existingMessages.length); i++) {
                    const incomingMsg = messages[i];
                    const existingMsg = existingMessages[i];

                    // Skip non-user/assistant messages
                    if (incomingMsg.role !== 'user' && incomingMsg.role !== 'assistant') {
                        continue;
                    }

                    // Check if user message content changed (edit detected)
                    if (existingMsg.role === 'user' && incomingMsg.role === 'user') {
                        const existingContent = getTextFromParts(existingMsg.parts);
                        const incomingContent = getTextFromParts(incomingMsg.parts);

                        if (existingContent !== incomingContent) {
                            editDetected = true;
                            editStartIndex = i;
                            break;
                        }
                    }

                    // Validate message ownership for existing messages
                    if (incomingMsg.id && existingMsg.id === incomingMsg.id) {
                        if (existingMsg.threadId !== threadId) {
                            setResponseStatus(event, 403);
                            return { error: "Message does not belong to this thread" };
                        }
                    }
                }
            }

            // If edit detected, delete all messages from edit point onwards
            if (editDetected && editStartIndex >= 0) {
                const messagesToDelete = existingMessages.slice(editStartIndex);
                for (const msgToDelete of messagesToDelete) {
                    await useDrizzle().delete(schema.messages)
                        .where(eq(schema.messages.id, msgToDelete.id))
                        .execute();
                }
            }

            // Save only the new messages that need to be added
            for (const [index, message] of messages.entries()) {
                if (message.role !== 'user' && message.role !== 'assistant') {
                    continue;
                }

                let shouldSave = false;

                if (editDetected) {
                    // For retry: only save the new user message (last one) if it's not duplicating an existing one
                    if (index === messages.length - 1 && message.role === 'user') {
                        // Check if this user message already exists
                        const userExists = existingMessages.some(existing => {
                            const existingContent = getTextFromParts(existing.parts);
                            const incomingContent = getTextFromParts(message.parts);
                            return existing.role === 'user' && existingContent === incomingContent;
                        });
                        shouldSave = !userExists; // Only save if it doesn't exist
                    }
                } else {
                    // For normal conversation: save only truly new messages
                    shouldSave = index >= existingMessages.length;
                }                if (shouldSave) {
                    const messageId = message.id || randomUUID();
                    await useDrizzle().insert(schema.messages)
                        .values({
                            id: messageId,
                            threadId: threadId,
                            role: message.role as 'user' | 'assistant',
                            status: index === messages.length - 1 ? 'pending' : 'done',
                            parts: message.parts || [],
                            model: model,
                            usage: (message as any).usage,
                            generationStartAt: (message as any).generationStartAt ? new Date((message as any).generationStartAt) : undefined,
                            generationEndAt: (message as any).generationEndAt ? new Date((message as any).generationEndAt) : undefined,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        })
                        .execute();

                    // Se è l'ultimo messaggio utente, salva l'id
                    if (index === messages.length - 1 && message.role === 'user') {
                        lastUserMessageId = messageId;
                        messageIdForGeneration = messageId; // Salva l'ID per la generazione
                    }
                }
            }

            // Collega attachmentIds al messaggio utente appena creato se aveva attachmentIds
            if (lastUserMessageId && Array.isArray(attachmentIds) && attachmentIds.length > 0) {
                await linkAttachmentsToMessage(lastUserMessageId, attachmentIds);
            }
        }

        // Update thread with last message timestamp and status
        await useDrizzle().update(schema.threads)
            .set({
                lastMessageAt: new Date(),
                updatedAt: new Date(),
                generationStatus: 'generating'
            })
            .where(eq(schema.threads.id, threadId))
            .execute();

        // Update user's last selected model
        const existingPrefs = await useDrizzle().select().from(schema.userPreferences).where(eq(schema.userPreferences.userId, userId)).get()
        if (existingPrefs) {
            await useDrizzle().update(schema.userPreferences)
                .set({
                    lastSelectedModel: model,
                    updatedAt: new Date()
                })
                .where(eq(schema.userPreferences.userId, userId))
                .execute()
        } else {
            await useDrizzle().insert(schema.userPreferences)
                .values({
                    userId,
                    lastSelectedModel: model,
                    name: '',
                    occupation: '',
                    selectedTraits: [],
                    additionalInfo: '',
                    createdAt: new Date(),
                    updatedAt: new Date()
                }).execute()
        }        // Get the ID of the last user message that will need generation
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
                let processed_attachments: { name: string; contentType: string; data: Buffer }[] | undefined = undefined; if (attachmentIds && attachmentIds.length > 0) {
                    try {
                        const attachmentsData = await useDrizzle().select()
                            .from(schema.attachments)
                            .where(inArray(schema.attachments.id, attachmentIds))
                            .all();

                        if (attachmentsData.length > 0) {
                            const attachmentsResult = await Promise.all(
                                attachmentsData.map(async (attachment) => {
                                    if (!attachment.attachmentUrl) {
                                        console.warn(`Attachment ${attachment.id} has no URL, skipping`);
                                        return null;
                                    }

                                    try {
                                        // Read file from storage
                                        const storage = useStorage('attachments');
                                        const buffer = await storage.getItemRaw(attachment.attachmentUrl);

                                        if (buffer) {
                                            return {
                                                name: attachment.fileName as string,
                                                contentType: attachment.mimeType as string,
                                                data: buffer as Buffer
                                            };
                                        }
                                    } catch (error) {
                                        console.error(`Failed to load attachment ${attachment.id}:`, error);
                                    }
                                    return null;
                                })
                            );

                            // Filter out failed attachments and assign with correct type
                            processed_attachments = attachmentsResult.filter(
                                (item): item is { name: string; contentType: string; data: Buffer } => !!item
                            );
                        }
                    } catch (error) {
                        console.error("Failed to retrieve attachments:", error);
                    }
                } const parsedMessages = messages.map((msg) => {
                    // Check if this message has only whitespace text and attachments
                    const textParts = msg.parts?.filter(part => part.type === 'text' && typeof part.text === 'string') || []
                    const hasOnlyWhitespace = textParts.length > 0 && textParts.every(part => !part.text.trim())
                    const hasAttachments = processed_attachments && processed_attachments.length > 0

                    return {
                        role: msg.role,
                        content: [
                            // Only include text parts if they have actual content or if there are no attachments
                            ...(textParts.filter(part => part.text.trim() || !hasAttachments).map(part => {
                                return {
                                    type: 'text' as const,
                                    text: part.text
                                };
                            }) || []),
                            ...(processed_attachments?.filter(att => att.data && att.name && att.contentType).map(att => {
                                if (att.contentType.startsWith('image/')) {
                                    return {
                                        type: 'image' as const,
                                        mimeType: att.contentType,
                                        image: att.data
                                    };
                                } else {
                                    return {
                                        type: 'file' as const,
                                        mimeType: att.contentType,
                                        data: att.contentType.startsWith('application/pdf') ? att.data.toString('base64') : att.data
                                    };
                                }
                            }) || [])
                        ]
                    }
                })

                // Check if it's an image generation request
                const isImageGeneration = llmInfo.features.includes(LLM_FEATURES.IMAGES);

                if (isImageGeneration) {
                    // Handle image generation
                    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
                    if (!lastUserMessage || !lastUserMessage.content || typeof lastUserMessage.content !== 'string') {
                        dataStream.writeData({
                            type: 'error',
                            error: 'No valid prompt found for image generation'
                        });
                        return;
                    }

                    const prompt = lastUserMessage.content;
                    const imageParams = modelParams?.imageGeneration || {
                        n: 1,
                        size: '1024x1024' as const,
                        openai: {
                            quality: 'auto' as const,
                            background: 'auto' as const,
                            output_format: 'png' as const,
                            output_compression: 100,
                            moderation: 'auto' as const
                        }
                    };

                    try {
                        const generationStartAt = Date.now();

                        // Build provider options for image generation
                        const imageProviderOptions: Record<string, any> = {};
                        if (imageParams.openai && llmInfo.provider === LLM_PROVIDERS.OPENAI) {
                            imageProviderOptions.openai = {
                                quality: imageParams.openai.quality || 'auto',
                                background: imageParams.openai.background || 'auto',
                                output_format: imageParams.openai.output_format || 'png',
                                output_compression: imageParams.openai.output_compression || 100,
                                moderation: imageParams.openai.moderation || 'auto'
                            };
                        }

                        // Create image model using utility function
                        const imageModel = getImageProvider(model, llmInfo, apiKeys);

                        // Convert size format for AI SDK
                        let size: `${number}x${number}` | undefined;
                        if (imageParams.size === 'auto') {
                            size = undefined; // Let the model decide
                        } else {
                            size = imageParams.size as `${number}x${number}`;
                        }

                        const imageResult = await generateImage({
                            model: imageModel,
                            prompt: prompt,
                            n: imageParams.n || 1,
                            size: size,
                            providerOptions: imageProviderOptions
                        });

                        const generationEndAt = Date.now();
                        const responseTime = (generationEndAt - generationStartAt) / 1000;

                        // Update message status
                        await useDrizzle().update(schema.messages)
                            .set({
                                status: 'done',
                                updatedAt: new Date()
                            })
                            .where(eq(schema.messages.id, messageId))
                            .execute();

                        // Add assistant message with images
                        const assistantMessageId = randomUUID();
                        let images: { base64: string; url?: string }[];

                        // Handle different result formats from AI SDK
                        if ('images' in imageResult && Array.isArray(imageResult.images)) {
                            images = imageResult.images.map((img: { base64: string; url?: string }) => ({
                                base64: img.base64,
                                url: img.url
                            }));
                        } else if ('image' in imageResult && imageResult.image) {
                            const img = imageResult.image as { base64: string; url?: string };
                            images = [{ base64: img.base64, url: img.url }];
                        } else {
                            images = [];
                        } const messageParts = images.map((img) => ({
                            type: 'file' as const,
                            mimeType: `image/${imageParams.openai?.output_format || 'png'}`,
                            data: `data:image/${imageParams.openai?.output_format || 'png'};base64,${img.base64}`
                        }));

                        await useDrizzle().insert(schema.messages)
                            .values({
                                id: assistantMessageId,
                                threadId: threadId,
                                role: 'assistant',
                                status: 'done',
                                parts: messageParts,
                                model: model,
                                generationStartAt: new Date(generationStartAt),
                                generationEndAt: new Date(generationEndAt),
                                createdAt: new Date(),
                                updatedAt: new Date()
                            }).execute();

                        // Update thread status
                        await useDrizzle().update(schema.threads)
                            .set({
                                generationStatus: 'completed',
                                updatedAt: new Date(),
                                lastMessageAt: new Date()
                            })
                            .where(eq(schema.threads.id, threadId))
                            .execute();

                        // Send image data in the stream for real-time UI update
                        dataStream.writeData({
                            type: 'images',
                            data: {
                                images: images.map((img) => ({
                                    base64: img.base64,
                                    url: img.url || ''
                                })),
                                messageId: assistantMessageId,
                                model,
                                generationStartAt,
                                generationEndAt,
                                responseTime
                            }
                        });

                    } catch (error) {
                        console.error("Image generation error:", error);
                        dataStream.writeData({
                            type: 'error',
                            error: error instanceof Error ? error.message : 'Image generation failed'
                        });

                        // Update message status to waiting
                        await useDrizzle().update(schema.messages)
                            .set({
                                status: 'waiting',
                                updatedAt: new Date()
                            })
                            .where(eq(schema.messages.id, messageId))
                            .execute();
                    }
                } else {
                    // Handle regular text generation
                    const tools: ToolSet = {};
                    let toolChoice: ToolChoice<ToolSet> | undefined = undefined;

                    if (webSearchEnabled && llmInfo.provider == LLM_PROVIDERS.OPENAI && llmInfo.features.includes(LLM_FEATURES.SEARCH)) {
                        tools.web_search_preview = openai.tools.webSearchPreview({
                            //todo add additional settings?
                        })

                        if (!toolChoice) {
                            toolChoice = {} as ToolChoice<ToolSet>;
                        }

                        toolChoice = {
                            type: 'tool',
                            toolName: 'web_search_preview',
                        }
                    }

                    const streamResult = streamText({
                        model: aiProvider,
                        maxTokens: 10000, //todo maybe use model-specific max tokens?
                        system: chatSystemPrompt(preferences, userInfo),
                        messages: parsedMessages,
                        providerOptions: providerOptions as any,
                        abortSignal: controller.signal,
                        tools: tools,
                        toolChoice: toolChoice,
                        experimental_transform: llmInfo.streamChunking ? smoothStream({
                            chunking: llmInfo.streamChunking || 'word', // Use model-specific chunking if available
                        }) : undefined,
                        async onFinish(streamResponse: any) {
                            const generationEndAt = Date.now()
                            const responseTime = (generationEndAt - generationStartAt) / 1000 // in seconds
                            const promptTokens = streamResponse.usage?.promptTokens || 0
                            const completionTokens = streamResponse.usage?.completionTokens || 0
                            const totalTokens = promptTokens + completionTokens
                            const tokensPerSecond = totalTokens / responseTime

                            // Update message status
                            await useDrizzle().update(schema.messages)
                                .set({
                                    status: 'done',
                                    updatedAt: new Date()
                                })
                                .where(eq(schema.messages.id, messageId))
                                .execute();

                            // Add assistant message
                            const assistantMessageId = randomUUID()

                            const messsageParts: typeof schema.messages.$inferInsert['parts'] = [];

                            if (streamResponse.reasoning) {
                                messsageParts.push({
                                    type: 'reasoning',
                                    reasoning: streamResponse.reasoning || '',
                                    details: [{
                                        type: 'text',
                                        text: streamResponse.reasoning || ''
                                    }]
                                });
                            }

                            messsageParts.push({
                                type: 'text',
                                text: streamResponse.text
                            });

                            await useDrizzle().insert(schema.messages)
                                .values({
                                    id: assistantMessageId,
                                    threadId: threadId,
                                    role: 'assistant',
                                    status: 'done',
                                    parts: messsageParts,
                                    usage: streamResponse.usage,
                                    model: model,
                                    generationStartAt: new Date(generationStartAt),
                                    generationEndAt: new Date(generationEndAt),
                                    createdAt: new Date(),
                                    updatedAt: new Date()
                                })
                                .execute();

                            // Update thread status
                            await useDrizzle().update(schema.threads)
                                .set({
                                    generationStatus: 'completed',
                                    updatedAt: new Date(),
                                    lastMessageAt: new Date()
                                })
                                .where(eq(schema.threads.id, threadId))
                                .execute();

                            // Send metrics in the stream
                            dataStream.writeData({
                                type: 'metrics',
                                data: {
                                    tokensPerSecond,
                                    promptTokens,
                                    completionTokens,
                                    totalTokens,
                                    generationStartAt,
                                    generationEndAt,
                                    model,
                                    messageId: assistantMessageId,
                                }
                            });
                        },
                        onError(error: any) {
                            console.error("AI generation error:", error);

                            /*dataStream.writeData({
                                type: 'error',
                                error: error instanceof Error ? error.message : 'Unknown error'
                            });*/

                            // Update message status to waiting
                            useDrizzle().update(schema.messages)
                                .set({
                                    status: 'waiting',
                                    updatedAt: new Date()
                                })
                                .where(eq(schema.messages.id, messageId))
                                .execute();
                        },
                    })

                    streamResult.mergeIntoDataStream(dataStream, {
                        sendReasoning: true,
                        sendUsage: true,
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