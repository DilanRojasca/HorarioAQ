-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "emailAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "emailSkippedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Notification_emailedAt_createdAt_idx" ON "Notification"("emailedAt", "createdAt");
