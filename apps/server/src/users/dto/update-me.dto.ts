import { IsBoolean, IsOptional, IsString, IsUrl, Length, Matches } from 'class-validator';

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @Length(3, 20)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Le pseudo ne peut contenir que des lettres, chiffres et underscores'
  })
  pseudo?: string;

  @IsOptional()
  @IsString()
  @IsUrl({}, { message: "L'URL Twitch n'est pas valide" })
  twitchUrl?: string;

  @IsOptional()
  @IsBoolean()
  allowPublicFriendRequests?: boolean;
}
