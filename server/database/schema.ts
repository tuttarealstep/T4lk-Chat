import { randomUUID } from 'node:crypto'
import { sql, relations } from 'drizzle-orm'
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import type { StepResult, Message, ToolSet } from 'ai';

//Auth schema
export const user = sqliteTable("user", {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: integer('email_verified', { mode: 'boolean' }).$defaultFn(() => false).notNull(),
    image: text('image'),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => /* @__PURE__ */ new Date()).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => /* @__PURE__ */ new Date()).notNull(),
    isAnonymous: integer('is_anonymous', { mode: 'boolean' })
});

export const session = sqliteTable("session", {
    id: text('id').primaryKey(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' })
});

export const account = sqliteTable("account", {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp' }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp' }),
    scope: text('scope'),
    password: text('password'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
});

export const verification = sqliteTable("verification", {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => /* @__PURE__ */ new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => /* @__PURE__ */ new Date())
});

// Chat schema
export const usersRelations = relations(user, ({ one, many }) => ({
    threads: many(threads),
    attachments: many(attachments),
    preferences: one(userPreferences)
}))

export const threads = sqliteTable('threads', {
    id: text().primaryKey().$defaultFn(() => randomUUID()),
    title: text(),
    userId: text().notNull(),
    userSetTitle: integer({ mode: "boolean" }),
    pinned: integer({ mode: "boolean" }),
    generationStatus: text({ enum: ['pending', 'generating', 'completed'] }).notNull(),
    branchedFromThreadId: text(),
    createdAt: integer({ mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer({ mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    lastMessageAt: integer({ mode: 'timestamp' })
}, t => [
    index('userIdIdx').on(t.userId),
    index('branchedFromThreadIdIdx').on(t.branchedFromThreadId)
])

export const threadsRelations = relations(threads, ({ one, many }) => ({
    user: one(user, {
        fields: [threads.userId],
        references: [user.id]
    }),
    messages: many(messages),
    branchedFromThread: one(threads, {
        fields: [threads.branchedFromThreadId],
        references: [threads.id],
        relationName: 'threadBranches'
    }),
    branchedThreads: many(threads, {
        relationName: 'threadBranches'
    })
}))

export const messages = sqliteTable('messages', {
    id: text().primaryKey().$defaultFn(() => randomUUID()),
    threadId: text().notNull().references(() => threads.id, { onDelete: 'cascade' }),
    role: text({ enum: ['user', 'assistant'] }).notNull(),
    status: text({ enum: ['pending', 'done', 'waiting'] }).notNull().default('pending'),
    parts: text({ mode: "json" }).$type<Message["parts"]>(), usage: text({ mode: "json" }).$type<StepResult<ToolSet>["usage"]>(),
    model: text().notNull(),
    generationStartAt: integer({ mode: 'timestamp' }),
    generationEndAt: integer({ mode: 'timestamp' }),
    createdAt: integer({ mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer({ mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
}, t => [
    index('messageIdIdx').on(t.threadId)
])

export const messagesRelations = relations(messages, ({ one, many }) => ({
    thread: one(threads, {
        fields: [messages.threadId],
        references: [threads.id]
    }),
    messageAttachments: many(messageAttachments)
}))

export const attachments = sqliteTable('attachments', {
    id: text().primaryKey().$defaultFn(() => randomUUID()),
    userId: text().notNull().references(() => user.id, { onDelete: 'cascade' }),
    status: text({ enum: ['pending', 'uploaded'] }).notNull().default('pending'),
    attachmentType: text().notNull(), // e.g. "text", "pdf", "image"
    attachmentUrl: text(),
    fileName: text().notNull(),
    mimeType: text(),
    fileSize: integer().notNull().default(0),
    createdAt: integer({ mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
}, t => [
    index('attachmentUserIdIdx').on(t.userId)
])

export const attachmentsRelations = relations(attachments, ({ one, many }) => ({
    user: one(user, {
        fields: [attachments.userId],
        references: [user.id]
    }),
    messageAttachments: many(messageAttachments)
}))

// Junction table for many-to-many relationship between messages and attachments
export const messageAttachments = sqliteTable('message_attachments', {
    id: text().primaryKey().$defaultFn(() => randomUUID()),
    messageId: text().notNull().references(() => messages.id, { onDelete: 'cascade' }),
    attachmentId: text().notNull().references(() => attachments.id, { onDelete: 'cascade' }),
    createdAt: integer({ mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
}, t => [
    index('messageAttachmentMessageIdIdx').on(t.messageId),
    index('messageAttachmentAttachmentIdIdx').on(t.attachmentId)
])

export const messageAttachmentsRelations = relations(messageAttachments, ({ one }) => ({
    message: one(messages, {
        fields: [messageAttachments.messageId],
        references: [messages.id]
    }),
    attachment: one(attachments, {
        fields: [messageAttachments.attachmentId],
        references: [attachments.id]
    })
}))

// User preferences schema
export const userPreferences = sqliteTable('user_preferences', {
    id: text().primaryKey().$defaultFn(() => randomUUID()),
    userId: text().notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
    additionalInfo: text().default(''), // max 3000 char
    name: text().default(''), // max 50 char
    occupation: text().default(''), // max 100 char
    selectedTraits: text({ mode: "json" }).$type<string[]>().$defaultFn(() => []), // strings max 50 - 100max char
    lastSelectedModel: text(), // Last selected model ID
    statsForNerds: integer({ mode: "boolean" }).default(false),
    createdAt: integer({ mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer({ mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
}, t => [
    index('userPreferencesUserIdIdx').on(t.userId)
])

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
    user: one(user, {
        fields: [userPreferences.userId],
        references: [user.id]
    })
}))

// Favorite models schema
export const favoriteModels = sqliteTable('favorite_models', {
    id: text().primaryKey().$defaultFn(() => randomUUID()),
    userId: text().notNull().references(() => user.id, { onDelete: 'cascade' }),
    modelId: text().notNull(),
    createdAt: integer({ mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, t => [
    index('favoriteModelsUserIdIdx').on(t.userId),
    index('favoriteModelsUserModelIdx').on(t.userId, t.modelId)
])

export const favoriteModelsRelations = relations(favoriteModels, ({ one }) => ({
    user: one(user, {
        fields: [favoriteModels.userId],
        references: [user.id]
    })
}))

// Shared chats schema
export const sharedChats = sqliteTable('shared_chats', {
    id: text().primaryKey().$defaultFn(() => randomUUID()),
    shareId: text().notNull().unique(), // Public share ID used in URL
    threadId: text().notNull().references(() => threads.id, { onDelete: 'cascade' }),
    userId: text().notNull().references(() => user.id, { onDelete: 'cascade' }),
    name: text(), // Display name for the share (optional)
    createdAt: integer({ mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer({ mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
}, t => [
    index('sharedChatsShareIdIdx').on(t.shareId),
    index('sharedChatsThreadIdIdx').on(t.threadId),
    index('sharedChatsUserIdIdx').on(t.userId)
])

export const sharedChatsRelations = relations(sharedChats, ({ one, many }) => ({
    thread: one(threads, {
        fields: [sharedChats.threadId],
        references: [threads.id]
    }),
    user: one(user, {
        fields: [sharedChats.userId],
        references: [user.id]
    }),
    sharedMessages: many(sharedMessages)
}))

// Shared messages schema - cloned messages at the time of sharing
export const sharedMessages = sqliteTable('shared_messages', {
    id: text().primaryKey().$defaultFn(() => randomUUID()),
    sharedChatId: text().notNull().references(() => sharedChats.id, { onDelete: 'cascade' }),
    originalMessageId: text().notNull(), // Reference to original message for tracking
    role: text({ enum: ['user', 'assistant'] }).notNull(),
    parts: text({ mode: "json" }).$type<Message["parts"]>(),
    usage: text({ mode: "json" }).$type<StepResult<ToolSet>["usage"]>(),
    model: text().notNull(),
    generationStartAt: integer({ mode: 'timestamp' }),
    generationEndAt: integer({ mode: 'timestamp' }),
    createdAt: integer({ mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
}, t => [
    index('sharedMessagesSharedChatIdIdx').on(t.sharedChatId)
])

export const sharedMessagesRelations = relations(sharedMessages, ({ one, many }) => ({
    sharedChat: one(sharedChats, {
        fields: [sharedMessages.sharedChatId],
        references: [sharedChats.id]
    }),
    sharedMessageAttachments: many(sharedMessageAttachments)
}))

// Junction table for shared message attachments
export const sharedMessageAttachments = sqliteTable('shared_message_attachments', {
    id: text().primaryKey().$defaultFn(() => randomUUID()),
    sharedMessageId: text().notNull().references(() => sharedMessages.id, { onDelete: 'cascade' }),
    attachmentId: text().notNull().references(() => attachments.id, { onDelete: 'cascade' }),
    createdAt: integer({ mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
}, t => [
    index('sharedMessageAttachmentSharedMessageIdIdx').on(t.sharedMessageId),
    index('sharedMessageAttachmentAttachmentIdIdx').on(t.attachmentId)
])

export const sharedMessageAttachmentsRelations = relations(sharedMessageAttachments, ({ one }) => ({
    sharedMessage: one(sharedMessages, {
        fields: [sharedMessageAttachments.sharedMessageId],
        references: [sharedMessages.id]
    }),
    attachment: one(attachments, {
        fields: [sharedMessageAttachments.attachmentId],
        references: [attachments.id]
    })
}))
