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

/** Password validation */
export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password || password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }
  if (password.length > 128) {
    return { valid: false, error: 'Password must not exceed 128 characters' };
  }
  return { valid: true };
}
