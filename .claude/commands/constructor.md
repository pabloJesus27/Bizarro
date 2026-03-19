Carga la skill del área correspondiente según el archivo o funcionalidad indicada.

Actúa como desarrollador senior especializado en TypeScript, Next.js 16 App Router, Supabase y Tailwind CSS v4.

Implementa lo siguiente: $ARGUMENTS

Requisitos obligatorios:
1. Código listo para producción, no ejemplos simplificados
2. Validación de inputs y manejo de errores completo
3. Tipos TypeScript en todo momento
4. Auth: `useAuth()` en cliente / `getAuthenticatedUser(req)` + `isProgramOwner()` en rutas API
5. DB: funciones en `src/lib/db.ts`, nunca queries directas fuera de db.ts
6. Sin `console.log` en producción — errores visibles al usuario via estado
7. Sin credenciales hardcodeadas — siempre `process.env.NOMBRE`
8. Comentarios solo donde la lógica no sea obvia

Entrega el código en bloques separados por archivo con la ruta como encabezado.
Al final, añade "Cómo probarlo" con pasos exactos.
Al terminar, actualiza la skill correspondiente si has aprendido algo nuevo.
Si la implementación implica una decisión de arquitectura relevante, guárdala en Engram con mem_save.
