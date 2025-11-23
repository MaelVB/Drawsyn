import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export interface ColorPalette {
  id: string;
  name: string;
  colors: string[];
}

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, trim: true })
  pseudo!: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ required: true })
  password!: string;

  @Prop({ required: false, trim: true })
  twitchUrl?: string;

  // Préférences liées aux amis
  @Prop({ default: true })
  allowPublicFriendRequests!: boolean;

  // Palettes de couleurs
  @Prop({ 
    type: [{ 
      id: String, 
      name: String, 
      colors: [String] 
    }], 
    default: () => [
      {
        id: 'rgbcmy',
        name: 'RGBCMY',
        colors: ['#FFFFFF', '#808080', '#000000', '#FF0000', '#CC0000', '#8B0000', '#00FF00', '#00CC00', '#006400', '#0000FF', '#0000CC', '#00008B', '#00FFFF', '#00CCCC', '#008B8B', '#FF00FF', '#CC00CC', '#8B008B', '#FFFF00', '#CCCC00', '#8B8B00']
      },
      {
        id: 'main',
        name: 'Principale',
        colors: [
          '#FFFFFF', // blanc
          '#868e96', // gris
          '#000000', // noir

          '#fa5252', // rouge
          '#fcc2d7', // rose clair
          '#ff8787', // rouge clair (NOUVEAU)

          '#cc5de8', // violet
          '#845ef7', // violet foncé
          '#b197fc', // violet clair (NOUVEAU)

          '#5c7cfa', // indigo
          '#339af0', // bleu
          '#74c0fc', // bleu clair (NOUVEAU)

          '#22b8cf', // cyan
          '#20c997', // vert turquoise
          '#63e6be', // turquoise clair (NOUVEAU)

          '#51cf66', // vert
          '#94d82d', // vert clair
          '#c0eb75', // vert pastel (NOUVEAU)

          '#ffd43b', // jaune
          '#ff922b', // orange
          '#ffb562'  // orange clair (NOUVEAU)
        ]
      }
    ]
  })
  colorPalettes!: ColorPalette[];

  @Prop({ default: 'main' })
  defaultColorPaletteId!: string;
}

export type UserDocument = HydratedDocument<User>;

export const UserSchema = SchemaFactory.createForClass(User);
