import { IsString, Length } from 'class-validator';

export class LoginDto {
  @IsString()
  @Length(3, 20)
  username!: string;

  @IsString()
  @Length(6, 50)
  password!: string;
}
