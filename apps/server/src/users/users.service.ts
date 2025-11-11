import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly model: Model<UserDocument>) {}

  async create(pseudo: string, email: string, password: string) {
    const created = new this.model({ pseudo, email, password });
    return created.save();
  }

  async findByPseudo(pseudo: string) {
    return this.model.findOne({ pseudo: pseudo.trim() }).exec();
  }

  async findByEmail(email: string) {
    return this.model.findOne({ email: email.toLowerCase().trim() }).exec();
  }

  async findById(id: string) {
    return this.model.findById(id).exec();
  }
}
