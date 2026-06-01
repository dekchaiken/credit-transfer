import { Schema, model, models } from 'mongoose';

const FacultySchema = new Schema({
  nameTh: { type: String, required: true, unique: true },
  nameEn: { type: String, default: '' },
}, { timestamps: true });

export const Faculty = models.Faculty || model('Faculty', FacultySchema);
