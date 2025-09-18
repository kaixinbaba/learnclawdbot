import { createDatabase } from './config';
import { createMockDatabase } from './mock';

export const db = process.env.DATABASE_URL
  ? createDatabase({ connectionString: process.env.DATABASE_URL })
  : createMockDatabase();

export const isDatabaseEnabled = !!process.env.DATABASE_URL;
