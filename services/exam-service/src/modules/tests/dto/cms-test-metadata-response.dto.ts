import { ApiProperty } from '@nestjs/swagger';

export class CmsTestMetadataDto {
  @ApiProperty({ type: String, minLength: 1, description: 'Opaque Test ID.' })
  id!: string;

  @ApiProperty({ type: String, nullable: true })
  title!: string | null;

  @ApiProperty({ type: String, enum: ['FULL', 'MINI', null], nullable: true })
  type!: 'FULL' | 'MINI' | null;

  @ApiProperty({ type: 'integer', minimum: 1, nullable: true, description: 'Stored seconds.' })
  durationSeconds!: number | null;

  @ApiProperty({
    type: 'integer',
    minimum: 0,
    nullable: true,
    description: 'Number of linked TestQuestion rows, not distinct questions or completeness.',
  })
  questionCount!: number | null;

  @ApiProperty({ type: String, nullable: true, description: 'Stored status code, not an enum.' })
  status!: string | null;
}

export class CmsTestMetadataPageDto {
  @ApiProperty({ type: [CmsTestMetadataDto] })
  items!: CmsTestMetadataDto[];

  @ApiProperty({ type: 'integer', minimum: 0 })
  total!: number;

  @ApiProperty({ type: 'integer', minimum: 1 })
  page!: number;

  @ApiProperty({ type: 'integer', minimum: 1, maximum: 50 })
  size!: number;
}
