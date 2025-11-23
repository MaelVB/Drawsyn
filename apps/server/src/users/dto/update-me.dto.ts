import { IsBoolean, IsOptional, IsString, IsUrl, Length, Matches, IsArray, ValidateNested, IsHexColor } from 'class-validator';
import { Type } from 'class-transformer';

export class ColorPaletteDto {
  @IsString()
  id!: string;

  @IsString()
  name!: string;

  @IsArray()
  @IsHexColor({ each: true })
  colors!: string[];
}

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

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ColorPaletteDto)
  colorPalettes?: ColorPaletteDto[];

  @IsOptional()
  @IsString()
  defaultColorPaletteId?: string;
}
