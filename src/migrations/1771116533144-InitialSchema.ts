import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1771116533144 implements MigrationInterface {
    name = 'InitialSchema1771116533144'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(255) NOT NULL, "name" character varying(255) NOT NULL, "password" character varying(255) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."test_results_config_type_enum" AS ENUM('SAML', 'OIDC')`);
        await queryRunner.query(`CREATE TABLE "test_results" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "configuration_id" uuid NOT NULL, "config_type" "public"."test_results_config_type_enum" NOT NULL, "user_id" uuid NOT NULL, "success" boolean NOT NULL, "error" jsonb, "claims" jsonb, "tokens" jsonb, "tested_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6af5df01fcd3971b362fc828296" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_79495e28d8f7b533323961d218" ON "test_results" ("configuration_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_e1d145d116b7bdcf870eb5b475" ON "test_results" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_04a24eac02bf2ff83c9873096f" ON "test_results" ("tested_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_002d7db6148407e92f3e222023" ON "test_results" ("configuration_id", "config_type") `);
        await queryRunner.query(`CREATE INDEX "IDX_fc040ffd1da98be9c315ef3e3e" ON "test_results" ("user_id", "tested_at") `);
        await queryRunner.query(`CREATE TABLE "saml_configurations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "idp_name" character varying(255) NOT NULL, "entity_id" text NOT NULL, "sso_url" text NOT NULL, "certificate" text NOT NULL, "protocol" character varying(10) NOT NULL DEFAULT 'SAML', "last_tested_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a732611b26aab5217d5e51332b1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_b20730d42ae2e49ed871a7e58d" ON "saml_configurations" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_a433fc22890c80666d383ee84a" ON "saml_configurations" ("user_id", "created_at") `);
        await queryRunner.query(`CREATE TABLE "oidc_configurations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "provider_name" character varying(255) NOT NULL, "issuer" text NOT NULL, "client_id" character varying(500) NOT NULL, "client_secret" text NOT NULL, "scopes" text NOT NULL, "protocol" character varying(10) NOT NULL DEFAULT 'OIDC', "last_tested_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_2175e894e621caefd470a2323bb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_3884122c06e36b2c6217b2c81c" ON "oidc_configurations" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_5c73b8450aae0bb57168e3f020" ON "oidc_configurations" ("user_id", "created_at") `);
        await queryRunner.query(`ALTER TABLE "test_results" ADD CONSTRAINT "FK_e1d145d116b7bdcf870eb5b4754" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "saml_configurations" ADD CONSTRAINT "FK_b20730d42ae2e49ed871a7e58dc" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "oidc_configurations" ADD CONSTRAINT "FK_3884122c06e36b2c6217b2c81c9" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "oidc_configurations" DROP CONSTRAINT "FK_3884122c06e36b2c6217b2c81c9"`);
        await queryRunner.query(`ALTER TABLE "saml_configurations" DROP CONSTRAINT "FK_b20730d42ae2e49ed871a7e58dc"`);
        await queryRunner.query(`ALTER TABLE "test_results" DROP CONSTRAINT "FK_e1d145d116b7bdcf870eb5b4754"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5c73b8450aae0bb57168e3f020"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3884122c06e36b2c6217b2c81c"`);
        await queryRunner.query(`DROP TABLE "oidc_configurations"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a433fc22890c80666d383ee84a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b20730d42ae2e49ed871a7e58d"`);
        await queryRunner.query(`DROP TABLE "saml_configurations"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fc040ffd1da98be9c315ef3e3e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_002d7db6148407e92f3e222023"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_04a24eac02bf2ff83c9873096f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e1d145d116b7bdcf870eb5b475"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_79495e28d8f7b533323961d218"`);
        await queryRunner.query(`DROP TABLE "test_results"`);
        await queryRunner.query(`DROP TYPE "public"."test_results_config_type_enum"`);
        await queryRunner.query(`DROP TABLE "users"`);
    }

}
