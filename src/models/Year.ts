import mongoose from 'mongoose';

const YearSchema = new mongoose.Schema(
  { year: { type: Number, required: true, unique: true } },
  { timestamps: true },
);

export const Year = (mongoose.models.Year as mongoose.Model<any>) ||
  mongoose.model('Year', YearSchema);
