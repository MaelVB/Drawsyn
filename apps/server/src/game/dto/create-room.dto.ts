import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateRoomDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(60)
  maxPlayers?: number; // Désormais optionnel: calculé via équipes si teamCount & teamSize sont définis

  @IsInt()
  @Min(0)
  @Max(240)
  roundDuration = 90;

  // Nombre total de rounds (une fois que chaque joueur a dessiné = 1 round)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  totalRounds: number = 3;

  // Équipes à la création (optionnel)
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(6)
  teamCount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  teamSize?: number;

  // Visibilité de la salle
  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;
}
