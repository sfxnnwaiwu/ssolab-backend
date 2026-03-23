import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPasswordResetTokens1771118000000 implements MigrationInterface {
    name = 'AddPasswordResetTokens1771118000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE "password_reset_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "email" character varying(255) NOT NULL, "token_hash" character varying(255) NOT NULL, "used" boolean NOT NULL DEFAULT false, "expires_at" TIMESTAMP NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e434675e9e8c61b89a3e4b3ba4" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `CREATE UNIQUE INDEX "IDX_unique_token_hash" ON "password_reset_tokens" ("token_hash")`,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_password_reset_tokens_user_id" ON "password_reset_tokens" ("user_id")`,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_password_reset_tokens_email" ON "password_reset_tokens" ("email")`,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_password_reset_tokens_expires_at" ON "password_reset_tokens" ("expires_at")`,
        );
        await queryRunner.query(
            `ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "FK_password_reset_tokens_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "password_reset_tokens" DROP CONSTRAINT "FK_password_reset_tokens_user_id"`,
        );
        await queryRunner.query(`DROP INDEX "public"."IDX_password_reset_tokens_expires_at"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_password_reset_tokens_email"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_password_reset_tokens_user_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_unique_token_hash"`);
        await queryRunner.query(`DROP TABLE "password_reset_tokens"`);
    }
}
