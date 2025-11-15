import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class SubmitDrawingDto {
  @IsString()
  @IsNotEmpty()
  roomId!: string;

  // Attendu: data URL PNG ou JPEG
  @IsString()
  @IsNotEmpty()
  @Matches(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/,{ message: 'imageData doit être un data URL PNG ou JPEG base64' })
  imageData!: string;

  // Optionnel: mot et turnIndex sont envoyés pour validation côté serveur
  @IsString()
  @IsNotEmpty()
  word!: string;

  @IsNotEmpty()
  turnIndex!: number;
}
