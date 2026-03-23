import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateResetPassword1774246880513 implements MigrationInterface {
    name = 'UpdateResetPassword1774246880513';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "password_reset_tokens" DROP CONSTRAINT "FK_password_reset_tokens_user_id"`,
        );
        await queryRunner.query(`DROP INDEX "public"."IDX_unique_token_hash"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_password_reset_tokens_user_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_password_reset_tokens_email"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_password_reset_tokens_expires_at"`);
        await queryRunner.query(
            `ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "UQ_91185d86d5d7557b19abbb2868b" UNIQUE ("token_hash")`,
        );
        await queryRunner.query(
            `ALTER TABLE "password_reset_tokens" ALTER COLUMN "user_id" DROP NOT NULL`,
        );
        await queryRunner.query(
            `CREATE INDEX "idx_password_reset_token_used" ON "password_reset_tokens" ("used") `,
        );
        await queryRunner.query(
            `CREATE INDEX "idx_password_reset_token_expires_at" ON "password_reset_tokens" ("expires_at") `,
        );
        await queryRunner.query(
            `CREATE INDEX "idx_password_reset_token_email" ON "password_reset_tokens" ("email") `,
        );
        await queryRunner.query(
            `ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "FK_52ac39dd8a28730c63aeb428c9c" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "password_reset_tokens" DROP CONSTRAINT "FK_52ac39dd8a28730c63aeb428c9c"`,
        );
        await queryRunner.query(`DROP INDEX "public"."idx_password_reset_token_email"`);
        await queryRunner.query(`DROP INDEX "public"."idx_password_reset_token_expires_at"`);
        await queryRunner.query(`DROP INDEX "public"."idx_password_reset_token_used"`);
        await queryRunner.query(
            `ALTER TABLE "password_reset_tokens" ALTER COLUMN "user_id" SET NOT NULL`,
        );
        await queryRunner.query(
            `ALTER TABLE "password_reset_tokens" DROP CONSTRAINT "UQ_91185d86d5d7557b19abbb2868b"`,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_password_reset_tokens_expires_at" ON "password_reset_tokens" ("expires_at") `,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_password_reset_tokens_email" ON "password_reset_tokens" ("email") `,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_password_reset_tokens_user_id" ON "password_reset_tokens" ("user_id") `,
        );
        await queryRunner.query(
            `CREATE UNIQUE INDEX "IDX_unique_token_hash" ON "password_reset_tokens" ("token_hash") `,
        );
        await queryRunner.query(
            `ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "FK_password_reset_tokens_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
    }
}
