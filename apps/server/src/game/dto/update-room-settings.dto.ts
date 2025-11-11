import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateRoomSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(12)
  maxPlayers?: number;

  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(240)
  roundDuration?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  totalRounds?: number;
}
