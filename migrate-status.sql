-- Convert Task.status from the TaskStatus enum to free text, preserving data.
ALTER TABLE "Task" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Task" ALTER COLUMN "status" TYPE TEXT USING "status"::text;
UPDATE "Task" SET "status" = 'Pending'      WHERE "status" = 'PENDING';
UPDATE "Task" SET "status" = 'In Progress'  WHERE "status" = 'IN_PROGRESS';
UPDATE "Task" SET "status" = 'Blocked'      WHERE "status" = 'BLOCKED';
UPDATE "Task" SET "status" = 'Done'         WHERE "status" = 'COMPLETED';
ALTER TABLE "Task" ALTER COLUMN "status" SET DEFAULT 'Pending';
