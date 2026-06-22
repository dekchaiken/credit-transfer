import mongoose from 'mongoose';
// register all schemas eagerly so populate() across refs always works (Next.js HMR safe)
import '@/models/User';
import '@/models/Program';
import '@/models/Faculty';
import '@/models/AcademicYear';
import '@/models/UniCourse';
import '@/models/CourseOffering';
import '@/models/TransferGroup';
import '@/models/Student';
import '@/models/TransferSheet';
import '@/models/Settings';
import '@/models/Year';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/credit_transfer';

declare global {
  // eslint-disable-next-line no-var
  var _mongoose: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null } | undefined;
}

const cached = global._mongoose ?? (global._mongoose = { conn: null, promise: null });

export async function dbConnect() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, { bufferCommands: false });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}
