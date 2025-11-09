import { IsOptional, IsString, Length } from 'class-validator';

export class JoinRoomDto {
  @IsString()
  roomId!: string;

  @IsString()
  @Length(2, 20)
  name!: string;

  @IsOptional()
  @IsString()
  avatar?: string;
}
