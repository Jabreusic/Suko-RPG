#!/usr/bin/env node

/**
 * Script para ejecutar extensiones de schema en Supabase vía PostgreSQL directo
 * 
 * Paso 1: Obtén la connection string desde Supabase Dashboard
 *   - Ve a Project Settings > Database > Connection string
 *   - Copia la URI (postgresql://postgres:...)
 * 
 * Paso 2: Ejecuta este script
 *   export DATABASE_URL="postgresql://postgres:PASSWORD@db.supabase.co:5432/postgres"
 *   node migrate_schema_extensions.js
 */

require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error(`
❌ Error: DATABASE_URL no está configurada

Para usar este script:
1. Ve a Supabase Dashboard > Project Settings > Database
2. Copia la Connection string (URI style)
3. Ejecuta:
   export DATABASE_URL="tu_connection_string_aqui"
   node migrate_schema_extensions.js
  `);
  process.exit(1);
}

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔄 Conectando a PostgreSQL...');
    await client.connect();
    console.log('✅ Conexión exitosa\n');

    // Leer archivo SQL
    const sqlPath = path.join(__dirname, 'supabase', 'schema_extensions.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // Dividir en statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt && !stmt.startsWith('--'));

    console.log(`📝 Ejecutando ${statements.length} statements...\n`);

    let success = 0;
    let skipped = 0;
    let errors = 0;

    for (const sql of statements) {
      const name = sql.match(/CREATE (?:TABLE|INDEX) IF NOT EXISTS (\w+)/)?.[1] || 'Statement';
      
      try {
        await client.query(sql);
        console.log(`✅ ${name}`);
        success++;
      } catch (err) {
        // Tabla/índice ya existe es OK
        if (err.code === '42P07' || err.code === '42P06') {
          console.log(`⏭️  ${name} (ya existe)`);
          skipped++;
        } else {
          console.error(`❌ ${name}: ${err.message.split('\n')[0]}`);
          errors++;
        }
      }
    }

    // Verificar tablas
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

    console.log(`\n📊 Resultados: ${success} creadas, ${skipped} saltadas, ${errors} errores`);
    console.log('✨ ¡Migración completada!');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
