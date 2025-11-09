import { IsInt, IsString, Max, Min } from 'class-validator';

export class CreateRoomDto {
  @IsString()
  name!: string;

  @IsInt()
  @Min(2)
  @Max(12)
  maxPlayers = 8;

  @IsInt()
  @Min(30)
  @Max(240)
  roundDuration = 90;
}
