import { db, schema } from "../../database";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
    try {
        const { id: shareId } = getRouterParams(event);

        if (!shareId) {
            setResponseStatus(event, 400);
            return { error: "Share ID is required" };
        }

        // Find the shared chat
        const sharedChat = await db.query.sharedChats.findFirst({
            where: eq(schema.sharedChats.shareId, shareId as string),
            with: {
                thread: {
                    columns: {
                        id: true,
                        title: true,
                        createdAt: true
                    }
                },
                sharedMessages: {
                    orderBy: (messages, { asc }) => [asc(messages.createdAt)],
                    with: {
                        sharedMessageAttachments: {
                            with: {
                                attachment: true
                            }
                        }
                    }
                }
            }
        });

        if (!sharedChat) {
            setResponseStatus(event, 404);
            return { error: "Share not found" };
        }

        // Process messages to include attachment parts (similar to thread API)
        const processedMessages = [];
        if (sharedChat.sharedMessages) {
            const storage = useStorage('attachments');
            
            for (const message of sharedChat.sharedMessages) {
                const processedMessage = {
                    id: message.id,
                    role: message.role,
                    parts: message.parts,
                    usage: message.usage,
                    model: message.model,
                    generationStartAt: message.generationStartAt,
                    generationEndAt: message.generationEndAt,
                    createdAt: message.createdAt
                };

                // Add attachment parts if any
                if (message.sharedMessageAttachments && message.sharedMessageAttachments.length > 0) {
                    const attachmentParts = await Promise.all(
                        message.sharedMessageAttachments.map(async (msgAtt) => {
                            const attachment = msgAtt.attachment;
                            if (!attachment.attachmentUrl) return null;

                            try {
                                // Read file from storage
                                const buffer = await storage.getItemRaw(attachment.attachmentUrl);
                                if (!buffer) return null;

                                // Create file part based on attachment type
                                if (attachment.mimeType?.startsWith('image/')) {
                                    return {
                                        type: 'file' as const,
                                        mimeType: attachment.mimeType,
                                        data: `data:${attachment.mimeType};base64,${buffer.toString('base64')}`
                                    };
                                } else if (attachment.mimeType === 'application/pdf') {
                                    return {
                                        type: 'file' as const,
                                        mimeType: attachment.mimeType,
                                        data: `data:${attachment.mimeType};base64,${buffer.toString('base64')}`,
                                        name: attachment.fileName
                                    };
                                } else {
                                    // For other file types, return as text content
                                    return {
                                        type: 'text' as const,
                                        text: `[Attachment: ${attachment.fileName}]`
                                    };
                                }
                            } catch (error) {
                                console.error('Error reading attachment:', error);
                                return {
                                    type: 'text' as const,
                                    text: `[Attachment: ${attachment.fileName} - Error loading]`
                                };
                            }
                        })
                    );

                    // Filter out null parts and add to message parts
                    const validAttachmentParts = attachmentParts.filter(part => part !== null);
                    if (validAttachmentParts.length > 0) {
                        processedMessage.parts = [...(processedMessage.parts || []), ...validAttachmentParts];
                    }
                }

                processedMessages.push(processedMessage);
            }
        }

        return {
            shareId: sharedChat.shareId,
            name: sharedChat.name,
            thread: {
                id: sharedChat.thread.id,
                title: sharedChat.thread.title,
                createdAt: sharedChat.thread.createdAt
            },
            messages: processedMessages,
            createdAt: sharedChat.createdAt,
            updatedAt: sharedChat.updatedAt
        };

    } catch (error) {
        console.error('Error getting shared chat:', error);
        setResponseStatus(event, 500);
        return { error: "Failed to get shared chat" };
    }
});
