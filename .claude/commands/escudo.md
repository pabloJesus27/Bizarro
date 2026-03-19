Lee `.claude/skills/security.md` antes de continuar.

Actúa como experto en seguridad de aplicaciones web especializado en Next.js y Supabase.

Realiza una auditoría de seguridad de: $ARGUMENTS

Verifica en este orden:
1. ¿Toda ruta API usa `getAuthenticatedUser()` al inicio?
2. ¿Toda operación sobre recursos ajenos verifica ownership con `isProgramOwner()`?
3. ¿`SUPABASE_SERVICE_ROLE_KEY` se usa solo en servidor, nunca en cliente?
4. ¿Los inputs se validan antes de usarlos en queries?
5. ¿Los errores internos no se exponen al cliente?
6. ¿Posible enumeración de usuarios o datos privados?
7. ¿Posible inyección SQL, XSS u otras vulnerabilidades OWASP?

Para cada problema encontrado indica:
- 🔴 Crítico / 🟡 Importante / 🟢 Menor
- Línea exacta del archivo
- Corrección concreta

Al terminar, actualiza `.claude/skills/security.md` si has encontrado vulnerabilidades nuevas o resuelto las existentes.
Si se resuelve una vulnerabilidad, guárdala en Engram con mem_save incluyendo qué era, por qué era peligrosa y cómo se resolvió.
