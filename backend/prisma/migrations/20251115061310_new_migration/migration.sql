/*
  Warnings:

  - You are about to drop the column `name` on the `users` table. All the data in the column will be lost.
  - Added the required column `first_name` to the `users` table without a default value. This is not possible if the table is not empty.
  - Added the required column `last_name` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "users" DROP COLUMN "name",
ADD COLUMN     "city" TEXT,
ADD COLUMN     "country_code" TEXT,
ADD COLUMN     "first_name" TEXT NOT NULL,
ADD COLUMN     "last_name" TEXT NOT NULL,
ADD COLUMN     "neighborhood" TEXT,
ADD COLUMN     "postal_code" TEXT,
ADD COLUMN     "second_last_name" TEXT,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "street" TEXT;
