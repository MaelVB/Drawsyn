import { IsArray, IsNumber, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class SegmentPointDto {
  @IsNumber()
  x!: number;

  @IsNumber()
  y!: number;

  @IsNumber()
  t!: number;
}

export class DrawSegmentDto {
  @IsString()
  roomId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SegmentPointDto)
  points!: SegmentPointDto[];
}
