import { auth } from "../../../lib/auth";
import { getMessageAttachmentIds } from "../../../utils/attachments";

export default defineEventHandler(async (event) => {
    try {
        const session = await auth.api.getSession({
            headers: event.headers
        });

        if (!session) {
            setResponseStatus(event, 401);
            return { error: "Unauthorized" };
        }

        const { messageId } = getRouterParams(event);

        if (!messageId) {
            setResponseStatus(event, 400);
            return { error: "Message ID is required" };
        }

        const attachmentIds = await getMessageAttachmentIds(messageId);

        return { attachmentIds };
    } catch (error) {
        console.error("Error in message attachments endpoint:", error);
        setResponseStatus(event, 500);
        return { error: "Internal server error" };
    }
});
