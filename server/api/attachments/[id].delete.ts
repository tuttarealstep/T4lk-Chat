import { auth } from "../../lib/auth";
import { defineEventHandler, createError } from 'h3';
import { useDrizzle, schema } from '../../database';
import { eq, and } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({
    headers: event.headers
  });

  if (!session) {
    setResponseStatus(event, 401);
    return { error: "Unauthorized" };
  }

  const attachmentId = getRouterParam(event, 'id');
  if (!attachmentId) {
    throw createError({ statusCode: 400, statusMessage: 'Attachment ID is required' });
  }

  try {
    // Find the attachment to delete
    const attachment = await useDrizzle().select()
      .from(schema.attachments)
      .where(and(
        eq(schema.attachments.id, attachmentId),
        eq(schema.attachments.userId, session.user.id)
      ))
      .get();

    if (!attachment) {
      throw createError({ statusCode: 404, statusMessage: 'Attachment not found' });
    }

    // Delete the file from storage
    const storage = useStorage('attachments');
    if (attachment.attachmentUrl) {
      try {
        await storage.removeItem(attachment.attachmentUrl);
      } catch (error) {
        console.warn('Failed to delete file from storage:', error);
        // Continue with database deletion even if file deletion fails
      }
    }

    // Delete from database
    await useDrizzle().delete(schema.attachments)
      .where(and(
        eq(schema.attachments.id, attachmentId),
        eq(schema.attachments.userId, session.user.id)
      ))
      .execute();

    return { success: true };
  } catch (error) {
    console.error('Error deleting attachment:', error);
    throw createError({ 
      statusCode: 500, 
      statusMessage: 'Failed to delete attachment' 
    });
  }
});
