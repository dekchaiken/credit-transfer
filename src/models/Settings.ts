import { Schema, model, models } from 'mongoose';

const SettingsSchema = new Schema({
  key: { type: String, required: true, unique: true },
  value: { type: Schema.Types.Mixed, required: true },
}, { timestamps: true });

export const Settings = models.Settings || model('Settings', SettingsSchema);

// Helper functions
export async function getSetting(key: string, defaultValue: any = null) {
  const doc = await Settings.findOne({ key }).lean() as { key: string; value: any } | null;
  return doc ? doc.value : defaultValue;
}

export async function setSetting(key: string, value: any) {
  await Settings.findOneAndUpdate(
    { key },
    { key, value },
    { upsert: true, new: true }
  );
}

// Default settings keys
export const SETTING_KEYS = {
  STUDENT_EMAIL_DOMAIN: 'studentEmailDomain',
} as const;
