import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import * as schema from '../db/schema';

async function main() {
  const { DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
  }
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error(
      'ADMIN_EMAIL and ADMIN_PASSWORD must be set in your environment before seeding. ' +
        'Never commit these values — set them in .env (local) or your hosting provider\'s ' +
        'environment variable settings (production).'
    );
  }
  if (ADMIN_PASSWORD.length < 8) {
    throw new Error('ADMIN_PASSWORD must be at least 8 characters.');
  }

  const sql = neon(DATABASE_URL);
  const db = drizzle(sql, { schema });

  const email = ADMIN_EMAIL.toLowerCase().trim();

  const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  if (existing) {
    await db
      .update(schema.users)
      .set({ passwordHash, role: 'admin', isActive: true, updatedAt: new Date() })
      .where(eq(schema.users.id, existing.id));
    console.log(`Admin user "${email}" already existed — password and role updated.`);
  } else {
    await db.insert(schema.users).values({
      email,
      username: email.split('@')[0],
      passwordHash,
      role: 'admin',
      isActive: true,
    });
    console.log(`Admin user "${email}" created successfully.`);
  }

  // Ensure a default settings row exists.
  const [settings] = await db.select().from(schema.appSettings).where(eq(schema.appSettings.id, 1)).limit(1);
  if (!settings) {
    await db.insert(schema.appSettings).values({ id: 1 });
    console.log('Default app settings row created.');
  }

  console.log('Seed complete. Admin password was never printed or logged.');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
