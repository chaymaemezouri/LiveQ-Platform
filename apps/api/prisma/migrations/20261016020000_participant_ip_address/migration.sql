ALTER TABLE "participants" ADD COLUMN "ip_address" VARCHAR(45);

CREATE UNIQUE INDEX "participants_session_id_ip_address_key"
  ON "participants"("session_id", "ip_address");
