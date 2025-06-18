PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_shared_chats` (
	`id` text PRIMARY KEY NOT NULL,
	`shareId` text NOT NULL,
	`threadId` text NOT NULL,
	`userId` text NOT NULL,
	`name` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`threadId`) REFERENCES `threads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_shared_chats`("id", "shareId", "threadId", "userId", "name", "createdAt", "updatedAt") SELECT "id", "shareId", "threadId", "userId", "name", "createdAt", "updatedAt" FROM `shared_chats`;--> statement-breakpoint
DROP TABLE `shared_chats`;--> statement-breakpoint
ALTER TABLE `__new_shared_chats` RENAME TO `shared_chats`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `shared_chats_shareId_unique` ON `shared_chats` (`shareId`);--> statement-breakpoint
CREATE INDEX `sharedChatsShareIdIdx` ON `shared_chats` (`shareId`);--> statement-breakpoint
CREATE INDEX `sharedChatsThreadIdIdx` ON `shared_chats` (`threadId`);--> statement-breakpoint
CREATE INDEX `sharedChatsUserIdIdx` ON `shared_chats` (`userId`);