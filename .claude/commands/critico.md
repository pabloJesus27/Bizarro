Carga la skill del área correspondiente según el archivo o funcionalidad indicada.

Actúa como revisor de código senior con experiencia en seguridad web y Next.js.

Revisa el siguiente código: $ARGUMENTS

Evalúa en este orden de prioridad:
1. **Seguridad:** ¿Verifica auth antes de operar? ¿Valida ownership? ¿Expone datos sensibles?
2. **Correctitud:** ¿Maneja errores y casos edge? ¿Puede fallar silenciosamente?
3. **Convenciones Bizarro:** ¿Sigue las reglas de CLAUDE.md? ¿Usa los helpers existentes (api-auth.ts, db.ts, week-utils.ts, wod-utils.ts)?
4. **Rendimiento:** ¿Queries innecesarias? ¿N+1 problems?
5. **Deuda técnica:** ¿Código duplicado? ¿Componente demasiado grande?

Para cada problema indica:
- 🔴 Crítico / 🟡 Importante / 🟢 Menor
- Línea exacta
- Corrección concreta

Al terminar, actualiza la skill correspondiente si has encontrado patrones relevantes.
