-- AlterTable: Add sharing fields to Rule
ALTER TABLE "Rule" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "Rule" ADD COLUMN "isShared" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Add sharing fields to Group
ALTER TABLE "Group" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "Group" ADD COLUMN "isShared" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Add sharing fields to Knowledge
ALTER TABLE "Knowledge" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "Knowledge" ADD COLUMN "isShared" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Add sharing fields to Category
ALTER TABLE "Category" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "Category" ADD COLUMN "isShared" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex: Index for filtering shared resources
CREATE INDEX "Rule_emailAccountId_isShared_idx" ON "Rule"("emailAccountId", "isShared");
CREATE INDEX "Group_emailAccountId_isShared_idx" ON "Group"("emailAccountId", "isShared");
CREATE INDEX "Knowledge_emailAccountId_isShared_idx" ON "Knowledge"("emailAccountId", "isShared");
CREATE INDEX "Category_emailAccountId_isShared_idx" ON "Category"("emailAccountId", "isShared");

-- CreateIndex: Index for creator lookup
CREATE INDEX "Rule_createdBy_idx" ON "Rule"("createdBy");
CREATE INDEX "Group_createdBy_idx" ON "Group"("createdBy");
CREATE INDEX "Knowledge_createdBy_idx" ON "Knowledge"("createdBy");
CREATE INDEX "Category_createdBy_idx" ON "Category"("createdBy");

-- AddForeignKey: Link createdBy to User
ALTER TABLE "Rule" ADD CONSTRAINT "Rule_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Group" ADD CONSTRAINT "Group_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Knowledge" ADD CONSTRAINT "Knowledge_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Category" ADD CONSTRAINT "Category_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
