import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const client = new Client({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function cleanDb() {
  try {
    await client.connect();

    // Delete posts with hardcoded UUIDs or titles that look like seed data
    const seedTitles = [
      'ConteúdXoXo Premium',
      'Guia Completo de Desenvolvimento',
      'Fotografia Profissional',
      'Design UX/UI Avançado',
      'Paisagens Naturais Incríveis',
      'Tutorial de React Hooks',
      'Animação Web Moderna',
      'Produção de Vídeo Profissional',
      'Copywriting que Vende'
    ];

    const { rowCount } = await client.query('DELETE FROM posts WHERE title = ANY($1)', [seedTitles]);
    console.log(`Deleted ${rowCount} seed posts.`);

    // Also delete profiles that are not the current user if they look fake
    // But we only have two: Power Ideas and alvaro.
    // alvaro is likely the user. Power Ideas might be seed.

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

cleanDb();
