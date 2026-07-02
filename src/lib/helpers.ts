import { Types } from 'mongoose';
import { NextResponse } from 'next/server';

/** Safe JSON parse - returns null on malformed body */
export async function safeParseBody<T = any>(req: Request): Promise<T | null> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

/** Validate MongoDB ObjectId format */
export function isValidObjectId(id: string): boolean {
  return Types.ObjectId.isValid(id) && new Types.ObjectId(id).toString() === id;
}

/** Return 400 response for invalid ObjectId */
export function invalidIdResponse() {
  return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
}

/** Return 400 response for malformed body */
export function invalidBodyResponse() {
  return NextResponse.json({ error: 'Invalid or missing request body' }, { status: 400 });
}

/** Pick only specified keys from an object (whitelist fields) */
export function pick<T extends Record<string, any>>(obj: T, keys: (keyof T)[]): Partial<T> {
  const result: Partial<T> = {};
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

/** Escape regex special characters */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Password validation — min 6 chars, upper, lower, special char */
export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password || password.length < 6) {
    return { valid: false, error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' };
  }
  if (password.length > 128) {
    return { valid: false, error: 'รหัสผ่านต้องไม่เกิน 128 ตัวอักษร' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'รหัสผ่านต้องมีตัวพิมพ์ใหญ่อย่างน้อย 1 ตัว' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'รหัสผ่านต้องมีตัวพิมพ์เล็กอย่างน้อย 1 ตัว' };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { valid: false, error: 'รหัสผ่านต้องมีอักขระพิเศษอย่างน้อย 1 ตัว เช่น !@#$%' };
  }
  return { valid: true };
}
