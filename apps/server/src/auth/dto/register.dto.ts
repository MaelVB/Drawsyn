import { IsEmail, IsString, Length, Matches } from 'class-validator';

export class RegisterDto {
  @IsString()
  @Length(3, 20)
  @Matches(/^[a-zA-Z0-9_]+$/, { message: 'Le pseudo ne peut contenir que des lettres, chiffres et underscores' })
  pseudo!: string;

  @IsEmail({}, { message: 'L\'adresse email n\'est pas valide' })
  email!: string;

  @IsString()
  @Length(6, 50, { message: 'Le mot de passe doit contenir entre 6 et 50 caractères' })
  password!: string;
}
