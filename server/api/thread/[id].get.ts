import { auth } from "../../lib/auth";
import { useDrizzle, schema } from "../../database";
import { eq, and } from "drizzle-orm";

export default defineEventHandler(async (event) => {
    try {
        const session = await auth.api.getSession({
            headers: event.headers
        });

        if (!session) {
            setResponseStatus(event, 401);
            return { error: "Unauthorized" };
        }

        const { id } = getRouterParams(event)

        const thread = await useDrizzle().query.threads.findFirst({
            where: and(
                eq(schema.threads.id, id as string),
                eq(schema.threads.userId, session.user?.id || session.user.id)
            ),
            with: {
                messages: {
                    columns: {
                        id: true,
                        role: true,
                        status: true,
                        parts: true,
                        usage: true,
                        model: true,
                        generationStartAt: true,
                        generationEndAt: true,
                        createdAt: true,
                        updatedAt: true
                    },
                    with: {
                        messageAttachments: {
                            with: {
                                attachment: true
                            }
                        }
                    }
                }
            }        });

        if (!thread) {
            setResponseStatus(event, 404)
            return { error: "Thread not found" }
        }

        // Process messages to include attachment parts
        if (thread.messages) {
            const storage = useStorage('attachments')
            
            for (const message of thread.messages) {
                if (message.messageAttachments && message.messageAttachments.length > 0) {
                    // Convert attachments to file parts
                    const attachmentParts = await Promise.all(
                        message.messageAttachments.map(async (msgAtt) => {
                            const attachment = msgAtt.attachment
                            if (!attachment.attachmentUrl) return null

                            try {
                                // Read file from storage
                                const buffer = await storage.getItemRaw(attachment.attachmentUrl)
                                if (!buffer) return null

                                // Create file part based on attachment type
                                if (attachment.mimeType?.startsWith('image/')) {
                                    return {
                                        type: 'file' as const,
                                        mimeType: attachment.mimeType,
                                        data: `data:${attachment.mimeType};base64,${(buffer as Buffer).toString('base64')}`
                                    }
                                } else {
                                    return {
                                        type: 'file' as const,
                                        mimeType: attachment.mimeType || 'application/octet-stream',
                                        data: (buffer as Buffer).toString('base64')
                                    }
                                }
                            } catch (error) {
                                console.error(`Failed to load attachment ${attachment.id}:`, error)
                                return null
                            }
                        })
                    )

                    // Filter out failed attachments and add to message parts
                    const validAttachmentParts = attachmentParts.filter(part => part !== null)
                    if (validAttachmentParts.length > 0) {
                        message.parts = [...(message.parts || []), ...validAttachmentParts]
                    }
                }
            }
        }

        return thread
    } catch (error) {
        console.error("Error in thread endpoint:", error);
        setResponseStatus(event, 500);
        return { error: "Internal server error" };
    }
})