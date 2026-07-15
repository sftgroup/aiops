-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" VARCHAR(20) NOT NULL DEFAULT 'user',
ADD COLUMN     "status" VARCHAR(20) NOT NULL DEFAULT 'active';

-- CreateTable
CREATE TABLE "operator_logs" (
    "id" UUID NOT NULL,
    "admin_id" UUID NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "target" VARCHAR(255),
    "detail" JSONB DEFAULT '{}',
    "ip" VARCHAR(45),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operator_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "operator_logs_admin_id_created_at_idx" ON "operator_logs"("admin_id", "created_at");

-- AddForeignKey
ALTER TABLE "operator_logs" ADD CONSTRAINT "operator_logs_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
