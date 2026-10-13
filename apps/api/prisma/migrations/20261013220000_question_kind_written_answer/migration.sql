CREATE TYPE "question_kind" AS ENUM ('CHOICE', 'TEXT');

ALTER TABLE "questions" ADD COLUMN "kind" "question_kind" NOT NULL DEFAULT 'CHOICE';

ALTER TABLE "votes" ALTER COLUMN "option_id" DROP NOT NULL;
ALTER TABLE "votes" ADD COLUMN "text_response" VARCHAR(500);

ALTER TABLE "votes" ADD CONSTRAINT "votes_answer_shape_check" CHECK (
  ("option_id" IS NOT NULL AND "text_response" IS NULL)
  OR (
    "option_id" IS NULL
    AND "text_response" IS NOT NULL
    AND length(btrim("text_response")) > 0
  )
);
