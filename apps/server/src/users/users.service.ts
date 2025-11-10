import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly model: Model<UserDocument>) {}

  async create(username: string, password: string) {
    const created = new this.model({ username, password });
    return created.save();
  }

  async findByUsername(username: string) {
    return this.model.findOne({ username: username.toLowerCase().trim() }).exec();
  }

  async findById(id: string) {
    return this.model.findById(id).exec();
  }
}
