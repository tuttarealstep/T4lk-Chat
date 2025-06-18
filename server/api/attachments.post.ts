import { auth } from "../lib/auth";
import { defineEventHandler, readMultipartFormData, createError } from 'h3';
import { useDrizzle, schema } from '../database';

import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';

const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
];

export default defineEventHandler(async (event) => {

  const session = await auth.api.getSession({
    headers: event.headers
  });

  if (!session) {
    setResponseStatus(event, 401);
    return { error: "Unauthorized" };
  }

  const form = await readMultipartFormData(event);
  if (!form) throw createError({ statusCode: 400, statusMessage: 'No form data' });

  const file = form.find(f => f.type && ALLOWED_MIME_TYPES.includes(f.type));
  if (!file) throw createError({ statusCode: 400, statusMessage: 'No valid file uploaded' });

  const ext = extname(file.filename || '').toLowerCase();
  const id = randomUUID();
  const storage = useStorage('attachments');
  const filePath = `${session.user.id}/${id}${ext}`;

  await storage.setItemRaw(filePath, file.data);

  // Determina il tipo di attachment
  let attachmentType = 'file';
  if (file.type?.startsWith('image/')) attachmentType = 'image';
  else if (file.type === 'application/pdf') attachmentType = 'pdf';

  // Inserisci nella tabella attachments
  const [attachment] = await useDrizzle().insert(schema.attachments)
    .values({
      id,
      userId: session.user.id,
      status: 'uploaded',
      attachmentType,
      attachmentUrl: filePath,
      fileName: file.filename || '',
      mimeType: file.type,
      fileSize: file.data.length,
      createdAt: new Date(),
    })
    .returning();

  return {
    ...attachment,
    url: `/api/attachments/${session.user.id}/${id}${ext}`,
  };
});
