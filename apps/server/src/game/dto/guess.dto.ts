import { IsString, Length } from 'class-validator';

export class GuessDto {
  @IsString()
  roomId!: string;

  @IsString()
  @Length(1, 64)
  text!: string;
}
