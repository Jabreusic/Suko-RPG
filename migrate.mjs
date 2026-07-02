#!/usr/bin/env node
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATABASE_URL = process.env.DATABASE_URL || 
  `postgresql://postgres:Qj0fGPjP7hSRUVOkxdB8Ag@db.ugkzdbldwgtktgzdtzld.supabase.co:5432/postgres`;

async function migrate() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔄 Conectando a PostgreSQL...');
    await client.connect();
    console.log('✅ Conectado\n');

    const sqlPath = path.join(__dirname, 'supabase', 'schema_extensions.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt && !stmt.startsWith('--'));

    console.log(`📝 Ejecutando ${statements.length} statements...\n`);

    let success = 0;
    let skipped = 0;

    for (const sql of statements) {
      const name = sql.match(/CREATE (?:TABLE|INDEX) IF NOT EXISTS (\w+)/)?.[1] || 'Statement';
      
      try {
        await client.query(sql);
        console.log(`✅ ${name}`);
        success++;
      } catch (err) {
        if (err.code === '42P07' || err.code === '42P06') {
          console.log(`⏭️  ${name} (ya existe)`);
          skipped++;
        } else {
          console.error(`❌ ${name}: ${err.message.split('\n')[0]}`);
        }
      }
    }

    console.log(`\n🔍 Verificando tablas...\n`);
    
    const tables = [
      'narrative_pressure',
      'faction_activity',
      'npc_goals',
      'off_screen_events',
      'bending_abilities',
      'relationships'
    ];

    for (const table of tables) {
      try {
        const { rows } = await client.query(`SELECT COUNT(*) as count FROM ${table};`);
        console.log(`✅ ${table}: ${rows[0].count} filas`);
      } catch (err) {
        console.log(`❌ ${table}: ${err.code === '42P01' ? 'No existe' : err.message}`);
      }
    }

    console.log(`\n✨ Migración completada: ${success} creadas, ${skipped} saltadas`);
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
