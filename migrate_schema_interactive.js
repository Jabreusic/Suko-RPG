#!/usr/bin/env node

/**
 * 🧙 Asistente Interactivo para Migración de Schema
 * 
 * Uso: node migrate_schema_interactive.js
 * 
 * Este script te guía a través del proceso de obtener la connection string
 * y ejecutar las migraciones en Supabase.
 */

const readline = require('readline');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (q) => new Promise(resolve => rl.question(q, resolve));

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║     🧙 Asistente Interactivo - Migración de Schema SUKO RPG      ║
╚═══════════════════════════════════════════════════════════════════╝

Este script ejecutará 6 nuevas tablas en tu base de datos Supabase:
  • narrative_pressure (Presión narrativa)
  • faction_activity (Actividad de facciones)
  • npc_goals (Objetivos de NPCs)
  • off_screen_events (Eventos sin jugador)
  • bending_abilities (Técnicas de bendición)
  • relationships (Dinámicas con NPCs)

`);

  const response = await question('¿Deseas continuar? (s/n): ');
  if (response.toLowerCase() !== 's' && response.toLowerCase() !== 'yes') {
    console.log('Cancelado.');
    rl.close();
    return;
  }

  console.log(`
📋 Para conectar a Supabase necesito tu connection string.

Opciones:
  1️⃣  Copiar y pegar la connection string (más fácil)
  2️⃣  Introducir datos manualmente (host, user, password, etc.)

¿Cuál prefieres?
`);

  const option = await question('Elige (1 o 2): ');

  let connectionString;

  if (option === '1') {
    console.log(`
📌 Para obtener tu connection string:
  1. Ve a https://app.supabase.com
  2. Abre tu proyecto (ugkzdbldwgtktgzdtzld)
  3. Settings → Database → Connection Strings
  4. Copia el URI (postgresql://...)
  5. Reemplaza [YOUR-PASSWORD] con tu contraseña
  
`);
    connectionString = await question('Pega tu connection string: ');
  } else if (option === '2') {
    console.log(`\nIngresa los datos de conexión:`);
    const host = await question('Host (db.supabase.co): ') || 'db.supabase.co';
    const port = await question('Puerto (5432): ') || '5432';
    const user = await question('Usuario (postgres): ') || 'postgres';
    const password = await question('Contraseña: ');
    const database = await question('Base de datos (postgres): ') || 'postgres';
    
    connectionString = `postgresql://${user}:${password}@${host}:${port}/${database}`;
  } else {
    console.log('❌ Opción inválida');
    rl.close();
    return;
  }

  rl.close();

  // Conectar y ejecutar
  console.log(`\n🔄 Conectando a Supabase...`);

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Conectado!\n');

    // Leer SQL
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

    // Verificar
    console.log(`\n🔍 Verificando tablas creadas...\n`);
    
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

    console.log(`
✨ ¡Migración completada exitosamente!

📊 Resultados: ${success} creadas, ${skipped} saltadas

Próximos pasos:
  1. Integrar GEMINI_PROMPT_MEJORADO.md en server.js
  2. Crear endpoints /api/pressure y /api/factions
  3. Agregar generador de off-screen events
  4. Actualizar frontend para mostrar presión narrativa

¡El sistema SUKO ahora tiene poder narrativo avanzado! 🎮
    `);
    
  } catch (err) {
    console.error('❌ Error de conexión:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
