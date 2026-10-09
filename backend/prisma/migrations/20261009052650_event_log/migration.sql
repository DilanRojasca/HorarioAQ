-- CreateTable
CREATE TABLE "DomainEvent" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DomainEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventDelivery" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "observer" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL,
    "error" TEXT,
    "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DomainEvent_occurredAt_idx" ON "DomainEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "EventDelivery_eventId_idx" ON "EventDelivery"("eventId");

-- AddForeignKey
ALTER TABLE "EventDelivery" ADD CONSTRAINT "EventDelivery_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "DomainEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
