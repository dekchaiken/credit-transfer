import { Schema, model, models } from 'mongoose';

const ProgramSchema = new Schema({
  code: { type: String, default: '' },
  nameTh: { type: String, required: true },
  nameEn: { type: String, default: '' },
  faculty: { type: String, default: '' },
}, { timestamps: true });

export const Program = models.Program || model('Program', ProgramSchema);
