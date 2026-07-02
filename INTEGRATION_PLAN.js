// INTEGRATION PLAN: Dice System + Narrative

/*
CAMBIOS A HACER EN server.js POST /api/message:

1. Después de cargar state (línea 881), agregar:
   - Cargar stats desde campaign_state.ability
   - Parse JSON si es necesario

2. En el bloque de mensajes normales (línea ~950):
   - Antes de buildNarrativePrompt
   - Detectar si acción necesita roll
   - Si sí, hacer performSkillCheck()
   - Guardar resultado

3. En buildNarrativePrompt:
   - Pasar resultado de roll como parámetro
   - Si hay roll, incluir en prompt:
     "[TIRADA DE DATOS]
      Habilidad: ${roll.skill}
      d20: ${roll.d20}
      Bonus: ${roll.bonus}
      Total: ${roll.total} vs DC ${roll.difficulty}
      Resultado: ${roll.success ? 'ÉXITO' : 'FRACASO'}
      ${roll.criticalSuccess ? '⭐ ¡ÉXITO CRÍTICO!' : ''}
      ${roll.criticalFailure ? '💀 ¡FRACASO CRÍTICO!' : ''}"
   
4. En prompt, pedir a Gemini:
   "Interpreta este resultado de dados narrativamente:
   - Si ÉXITO: El jugador logra lo que intentó, pero aparecen consecuencias.
   - Si FRACASO: El intento falla de forma dramática, abriendo nuevas complicaciones.
   - Si CRÍTICO ÉXITO: Éxito espectacular con beneficios inesperados.
   - Si CRÍTICO FRACASO: Fracaso desastroso con consecuencias severas."

5. Actualizar response JSON:
   - Incluir diceRoll en response
   - Cliente puede mostrar visualmente

FLUJO COMPLETO:
Acción → ¿Necesita roll? → Hacer roll → Pasar a Gemini → Generar narrativa con consecuencias
*/

console.log('✅ Integration plan ready for implementation');
