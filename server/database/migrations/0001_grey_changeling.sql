CREATE TABLE `shared_chats` (
	`id` text PRIMARY KEY NOT NULL,
	`shareId` text NOT NULL,
	`threadId` text NOT NULL,
	`userId` text NOT NULL,
	`name` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`threadId`) REFERENCES `threads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shared_chats_shareId_unique` ON `shared_chats` (`shareId`);--> statement-breakpoint
CREATE INDEX `sharedChatsShareIdIdx` ON `shared_chats` (`shareId`);--> statement-breakpoint
CREATE INDEX `sharedChatsThreadIdIdx` ON `shared_chats` (`threadId`);--> statement-breakpoint
CREATE INDEX `sharedChatsUserIdIdx` ON `shared_chats` (`userId`);--> statement-breakpoint
CREATE TABLE `shared_message_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`sharedMessageId` text NOT NULL,
	`attachmentId` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`sharedMessageId`) REFERENCES `shared_messages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`attachmentId`) REFERENCES `attachments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sharedMessageAttachmentSharedMessageIdIdx` ON `shared_message_attachments` (`sharedMessageId`);--> statement-breakpoint
CREATE INDEX `sharedMessageAttachmentAttachmentIdIdx` ON `shared_message_attachments` (`attachmentId`);--> statement-breakpoint
CREATE TABLE `shared_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`sharedChatId` text NOT NULL,
	`originalMessageId` text NOT NULL,
	`role` text NOT NULL,
	`parts` text,
	`usage` text,
	`model` text NOT NULL,
	`generationStartAt` integer,
	`generationEndAt` integer,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`sharedChatId`) REFERENCES `shared_chats`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sharedMessagesSharedChatIdIdx` ON `shared_messages` (`sharedChatId`);