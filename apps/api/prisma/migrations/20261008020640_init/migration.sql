-- CreateEnum
CREATE TYPE "session_status" AS ENUM ('DRAFT', 'LIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "question_run_status" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "display_name" VARCHAR(80) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "join_code" VARCHAR(8) NOT NULL,
    "status" "session_status" NOT NULL DEFAULT 'DRAFT',
    "started_at" TIMESTAMPTZ(3),
    "ended_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "prompt" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_options" (
    "id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "label" VARCHAR(500) NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "question_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "correct_answers" (
    "question_id" UUID NOT NULL,
    "option_id" UUID NOT NULL,

    CONSTRAINT "correct_answers_pkey" PRIMARY KEY ("question_id")
);

-- CreateTable
CREATE TABLE "participants" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "nickname" VARCHAR(40),
    "joined_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_runs" (
    "id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "status" "question_run_status" NOT NULL DEFAULT 'OPEN',
    "open_session_id" UUID,
    "timer_seconds" INTEGER,
    "opened_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closes_at" TIMESTAMPTZ(3),
    "closed_at" TIMESTAMPTZ(3),
    "results_published_at" TIMESTAMPTZ(3),

    CONSTRAINT "question_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "votes" (
    "id" UUID NOT NULL,
    "question_run_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "participant_id" UUID NOT NULL,
    "option_id" UUID NOT NULL,
    "submitted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "votes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_join_code_key" ON "sessions"("join_code");

-- CreateIndex
CREATE INDEX "sessions_owner_id_status_idx" ON "sessions"("owner_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "questions_id_session_id_key" ON "questions"("id", "session_id");

-- CreateIndex
CREATE UNIQUE INDEX "questions_session_id_position_key" ON "questions"("session_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "question_options_id_question_id_key" ON "question_options"("id", "question_id");

-- CreateIndex
CREATE UNIQUE INDEX "question_options_question_id_position_key" ON "question_options"("question_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "correct_answers_option_id_question_id_key" ON "correct_answers"("option_id", "question_id");

-- CreateIndex
CREATE UNIQUE INDEX "participants_token_hash_key" ON "participants"("token_hash");

-- CreateIndex
CREATE INDEX "participants_session_id_idx" ON "participants"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "participants_id_session_id_key" ON "participants"("id", "session_id");

-- CreateIndex
CREATE UNIQUE INDEX "question_runs_open_session_id_key" ON "question_runs"("open_session_id");

-- CreateIndex
CREATE INDEX "question_runs_session_id_status_idx" ON "question_runs"("session_id", "status");

-- CreateIndex
CREATE INDEX "question_runs_question_id_opened_at_idx" ON "question_runs"("question_id", "opened_at");

-- CreateIndex
CREATE UNIQUE INDEX "question_runs_id_question_id_session_id_key" ON "question_runs"("id", "question_id", "session_id");

-- CreateIndex
CREATE INDEX "votes_question_run_id_option_id_idx" ON "votes"("question_run_id", "option_id");

-- CreateIndex
CREATE UNIQUE INDEX "votes_question_run_id_participant_id_key" ON "votes"("question_run_id", "participant_id");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correct_answers" ADD CONSTRAINT "correct_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correct_answers" ADD CONSTRAINT "correct_answers_option_id_question_id_fkey" FOREIGN KEY ("option_id", "question_id") REFERENCES "question_options"("id", "question_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participants" ADD CONSTRAINT "participants_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_runs" ADD CONSTRAINT "question_runs_question_id_session_id_fkey" FOREIGN KEY ("question_id", "session_id") REFERENCES "questions"("id", "session_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_runs" ADD CONSTRAINT "question_runs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_question_run_id_question_id_session_id_fkey" FOREIGN KEY ("question_run_id", "question_id", "session_id") REFERENCES "question_runs"("id", "question_id", "session_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_option_id_question_id_fkey" FOREIGN KEY ("option_id", "question_id") REFERENCES "question_options"("id", "question_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_participant_id_session_id_fkey" FOREIGN KEY ("participant_id", "session_id") REFERENCES "participants"("id", "session_id") ON DELETE CASCADE ON UPDATE CASCADE;
