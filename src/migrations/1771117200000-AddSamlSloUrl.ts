import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddSamlSloUrl1771117200000 implements MigrationInterface {
    name = 'AddSamlSloUrl1771117200000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(
            'saml_configurations',
            new TableColumn({
                name: 'slo_url',
                type: 'text',
                isNullable: true,
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('saml_configurations', 'slo_url');
    }
}
