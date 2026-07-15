-- CreateTable
CREATE TABLE "publish_records" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID,
    "content_id" UUID,
    "account_id" VARCHAR(255) NOT NULL,
    "platform" VARCHAR(50) NOT NULL,
    "screen_name" VARCHAR(255),
    "text" VARCHAR(500),
    "status" VARCHAR(20) NOT NULL DEFAULT 'published',
    "result" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "publish_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "publish_records_tenant_id_created_at_idx" ON "publish_records"("tenant_id", "created_at");

-- AddForeignKey
ALTER TABLE "publish_records" ADD CONSTRAINT "publish_records_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
