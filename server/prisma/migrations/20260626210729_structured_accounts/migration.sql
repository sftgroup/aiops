/*
  Warnings:

  - You are about to drop the column `data` on the `accounts` table. All the data in the column will be lost.
  - Added the required column `name` to the `accounts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `platform` to the `accounts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `accounts` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "accounts" DROP COLUMN "data",
ADD COLUMN     "credentials" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "metadata" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "name" VARCHAR(255) NOT NULL,
ADD COLUMN     "platform" VARCHAR(50) NOT NULL,
ADD COLUMN     "platform_user_id" VARCHAR(255),
ADD COLUMN     "screen_name" VARCHAR(255),
ADD COLUMN     "updated_at" TIMESTAMPTZ(6) NOT NULL,
ADD COLUMN     "user_id" UUID;

-- CreateIndex
CREATE INDEX "accounts_tenant_id_platform_idx" ON "accounts"("tenant_id", "platform");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
