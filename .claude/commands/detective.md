Carga la skill del área correspondiente según el archivo o funcionalidad indicada.

Actúa como experto en debugging de aplicaciones Next.js + Supabase.

Investiga el siguiente problema: $ARGUMENTS

Sigue este orden estrictamente:
1. Lee el código relevante antes de proponer nada
2. Busca la causa raíz, no los síntomas
3. Comprueba: ¿auth/sesión válida? ¿RLS de Supabase bloqueando? ¿tipos TypeScript incorrectos? ¿estado de React desincronizado?
4. Identifica si el error es en cliente, servidor, o base de datos
5. Propón la corrección mínima que resuelve el problema sin romper nada más
6. Explica por qué ocurría

No propongas soluciones hasta haber leído el código implicado.
Al terminar, actualiza la skill correspondiente si el bug revela un patrón a evitar en el futuro.
Guarda el bug resuelto en Engram con mem_save: qué fallaba, causa raíz, solución aplicada.
