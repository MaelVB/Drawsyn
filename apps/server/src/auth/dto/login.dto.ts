import { IsString, Length } from 'class-validator';

export class LoginDto {
  @IsString()
  @Length(3, 100)
  identifier!: string; // Peut être un pseudo ou un email

  @IsString()
  @Length(6, 50)
  password!: string;
}
