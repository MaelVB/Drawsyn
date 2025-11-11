import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

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

  // Nombre total de rounds (une fois que chaque joueur a dessiné = 1 round)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  totalRounds: number = 3;
}
