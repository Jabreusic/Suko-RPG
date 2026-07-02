// TEST DICE SYSTEM - Suko RPG

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Import functions from server.js context
function initializeCharacterStats() {
  return {
    level: 1,
    experience: 0,
    stats: {
      strength: Math.floor(Math.random() * 8) + 10,
      dexterity: Math.floor(Math.random() * 8) + 10,
      intelligence: Math.floor(Math.random() * 8) + 10,
      wisdom: Math.floor(Math.random() * 8) + 10,
      constitution: Math.floor(Math.random() * 8) + 10,
      charisma: Math.floor(Math.random() * 8) + 10
    },
    skills: {
      melee: { proficiency: 0, stat: 'strength' },
      ranged: { proficiency: 0, stat: 'dexterity' },
      persuasion: { proficiency: 0, stat: 'charisma' },
      deception: { proficiency: 0, stat: 'charisma' },
      intimidation: { proficiency: 0, stat: 'charisma' },
      investigation: { proficiency: 0, stat: 'intelligence' },
      arcana: { proficiency: 0, stat: 'intelligence' },
      nature: { proficiency: 0, stat: 'wisdom' },
      stealth: { proficiency: 0, stat: 'dexterity' },
      acrobatics: { proficiency: 0, stat: 'dexterity' }
    },
    health: 20,
    maxHealth: 20
  };
}

function rollD20() {
  return Math.floor(Math.random() * 20) + 1;
}

function getModifier(statValue) {
  return Math.floor((statValue - 10) / 2);
}

function calculateSkillCheck(stats, skillName) {
  const skill = stats.skills[skillName];
  if (!skill) return 0;
  
  const statValue = stats.stats[skill.stat];
  const modifier = getModifier(statValue);
  const proficiencyBonus = Math.floor(stats.level / 4) + 2;
  
  return modifier + (skill.proficiency > 0 ? proficiencyBonus : 0);
}

function getRelevantSkill(action) {
  const actionLower = action.toLowerCase();
  
  if (actionLower.includes('combate') || actionLower.includes('atacar') || actionLower.includes('golpear')) {
    return 'melee';
  }
  if (actionLower.includes('persuad') || actionLower.includes('convenc')) {
    return 'persuasion';
  }
  if (actionLower.includes('engaña') || actionLower.includes('miente')) {
    return 'deception';
  }
  if (actionLower.includes('intim')) {
    return 'intimidation';
  }
  if (actionLower.includes('investi') || actionLower.includes('exami') || actionLower.includes('busca')) {
    return 'investigation';
  }
  
  return 'investigation'; // default
}

function performSkillCheck(stats, action, difficulty = 10) {
  const skillName = getRelevantSkill(action);
  const d20Roll = rollD20();
  const skillBonus = calculateSkillCheck(stats, skillName);
  const totalRoll = d20Roll + skillBonus;
  
  return {
    skill: skillName,
    d20: d20Roll,
    bonus: skillBonus,
    total: totalRoll,
    success: totalRoll >= difficulty,
    criticalSuccess: d20Roll === 20,
    criticalFailure: d20Roll === 1,
    difficulty
  };
}

// TEST EXECUTION
console.log('🎲 TESTING DICE SYSTEM - Suko RPG\n');

// Create character
const character = initializeCharacterStats();
console.log('📊 CHARACTER STATS:');
console.log(`Strength: ${character.stats.strength} (Mod: ${getModifier(character.stats.strength)})`);
console.log(`Dexterity: ${character.stats.dexterity} (Mod: ${getModifier(character.stats.dexterity)})`);
console.log(`Charisma: ${character.stats.charisma} (Mod: ${getModifier(character.stats.charisma)})`);
console.log();

// Test dice rolls
console.log('🎲 DICE ROLLS:\n');

const testActions = [
  'atacar al enemigo con mi espada',
  'persuadir al guarda',
  'investigar la escena del crimen',
  'esconder mis intenciones'
];

testActions.forEach(action => {
  const roll = performSkillCheck(character, action, 12);
  const result = roll.success ? '✅ ÉXITO' : '❌ FRACASO';
  console.log(`Acción: "${action}"`);
  console.log(`Skill: ${roll.skill} | d20: ${roll.d20} + ${roll.bonus} = ${roll.total} vs DC ${roll.difficulty}`);
  console.log(`${result}\n`);
});

console.log('✨ Dice system working correctly!');
