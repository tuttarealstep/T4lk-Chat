import { auth } from "../../lib/auth";
import { defineEventHandler, readBody } from 'h3';
import { useDrizzle, schema } from '../../database';
import { inArray, eq, and } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({
    headers: event.headers
  });

  if (!session) {
    setResponseStatus(event, 401);
    return { error: "Unauthorized" };
  }

  const body = await readBody(event);
  const { attachmentIds } = body;

  if (!Array.isArray(attachmentIds) || attachmentIds.length === 0) {
    setResponseStatus(event, 400);
    return { error: "Invalid attachment IDs" };
  }

  try {
    // Filter to only include attachments owned by the current user
    const ownedAttachments = await useDrizzle().select({
      id: schema.attachments.id,
      fileName: schema.attachments.fileName,
      fileSize: schema.attachments.fileSize,
      mimeType: schema.attachments.mimeType
    })
      .from(schema.attachments)
      .where(
        and(
          inArray(schema.attachments.id, attachmentIds),
          eq(schema.attachments.userId, session.user.id)
        )
      )
      .all();

    return { attachments: ownedAttachments };
  } catch (error) {
    console.error('Error fetching attachment details:', error);
    setResponseStatus(event, 500);
    return { error: "Failed to fetch attachment details" };
  }
});
