import { createDatabase } from './config';

const connectionString = process.env.DATABASE_URL;

export const isDatabaseEnabled = !!connectionString;

export const db = connectionString
  ? createDatabase({ connectionString })
  : (null as unknown as ReturnType<typeof createDatabase>);