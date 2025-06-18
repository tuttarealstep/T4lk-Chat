CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attachmentType` text NOT NULL,
	`attachmentUrl` text,
	`fileName` text NOT NULL,
	`mimeType` text,
	`fileSize` integer DEFAULT 0 NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `attachmentUserIdIdx` ON `attachments` (`userId`);--> statement-breakpoint
CREATE TABLE `favorite_models` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`modelId` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `favoriteModelsUserIdIdx` ON `favorite_models` (`userId`);--> statement-breakpoint
CREATE INDEX `favoriteModelsUserModelIdx` ON `favorite_models` (`userId`,`modelId`);--> statement-breakpoint
CREATE TABLE `message_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`messageId` text NOT NULL,
	`attachmentId` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`messageId`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`attachmentId`) REFERENCES `attachments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `messageAttachmentMessageIdIdx` ON `message_attachments` (`messageId`);--> statement-breakpoint
CREATE INDEX `messageAttachmentAttachmentIdIdx` ON `message_attachments` (`attachmentId`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`threadId` text NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`parts` text,
	`usage` text,
	`model` text NOT NULL,
	`generationStartAt` integer,
	`generationEndAt` integer,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`threadId`) REFERENCES `threads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `messageIdIdx` ON `messages` (`threadId`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE TABLE `threads` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text,
	`userId` text NOT NULL,
	`userSetTitle` integer,
	`pinned` integer,
	`generationStatus` text NOT NULL,
	`branchedFromThreadId` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	`lastMessageAt` integer
);
--> statement-breakpoint
CREATE INDEX `userIdIdx` ON `threads` (`userId`);--> statement-breakpoint
CREATE INDEX `branchedFromThreadIdIdx` ON `threads` (`branchedFromThreadId`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`is_anonymous` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`additionalInfo` text DEFAULT '',
	`name` text DEFAULT '',
	`occupation` text DEFAULT '',
	`selectedTraits` text,
	`lastSelectedModel` text,
	`statsForNerds` integer DEFAULT false,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_preferences_userId_unique` ON `user_preferences` (`userId`);--> statement-breakpoint
CREATE INDEX `userPreferencesUserIdIdx` ON `user_preferences` (`userId`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
