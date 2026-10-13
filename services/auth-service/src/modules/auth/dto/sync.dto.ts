import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class SyncUserDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  clientDeviceId!: string;

  @ApiProperty({ description: 'Thời điểm đồng bộ cuối (epoch millis)' })
  @IsInt()
  @Min(0)
  lastSyncTime!: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  version!: number;
}
