import { useDrizzle, schema } from "../../database";
import { inArray } from "drizzle-orm";

export interface ProcessedAttachment {
  name: string;
  contentType: string;
  data: Buffer;
}

export async function processAttachments(attachmentIds: string[]): Promise<ProcessedAttachment[]> {
  if (!attachmentIds || attachmentIds.length === 0) {
    return [];
  }

  try {
    const attachmentsData = await useDrizzle().select()
      .from(schema.attachments)
      .where(inArray(schema.attachments.id, attachmentIds))
      .all();

    if (attachmentsData.length === 0) {
      return [];
    }

    const attachmentsResult = await Promise.all(
      attachmentsData.map(async (attachment) => {
        if (!attachment.attachmentUrl) {
          console.warn(`Attachment ${attachment.id} has no URL, skipping`);
          return null;
        }

        try {
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

    return attachmentsResult.filter(
      (item): item is ProcessedAttachment => !!item
    );
  } catch (error) {
    console.error("Failed to retrieve attachments:", error);
    return [];
  }
}

export function convertAttachmentsToMessageContent(
  attachments: ProcessedAttachment[],
  hasOnlyWhitespaceText: boolean = false
) {
  return attachments
    .filter(att => att.data && att.name && att.contentType)
    .map(att => {
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
          data: att.contentType.startsWith('application/pdf') 
            ? att.data.toString('base64') 
            : att.data
        };
      }
    });
}