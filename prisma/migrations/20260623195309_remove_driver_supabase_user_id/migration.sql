/*
  Warnings:

  - You are about to drop the column `supabaseUserId` on the `Driver` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Driver_supabaseUserId_key";

-- AlterTable
ALTER TABLE "Driver" DROP COLUMN "supabaseUserId";
