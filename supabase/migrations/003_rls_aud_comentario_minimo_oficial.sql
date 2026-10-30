-- 003_rls_aud_comentario_minimo_oficial.sql
-- Correccion de seguridad: activar Row Level Security en aud_comentario_minimo_oficial.
-- Contexto: era la unica tabla aud_* con RLS DESACTIVADO (851 filas expuestas a la anon key).
-- Se replica el patron de las tablas hermanas (aud_preguntas, aud_comentario_esquema):
--   RLS activo + politica de SELECT para 'authenticated' con USING (true).
-- Las escrituras siguen reservadas a service_role/postgres (que hacen bypass de RLS),
-- igual que en el resto del catalogo. El cliente no lee esta tabla directamente hoy,
-- por lo que el cambio no afecta ninguna consulta actual.
-- Fecha: 2026-09-24

alter table public.aud_comentario_minimo_oficial enable row level security;

drop policy if exists aud_comentario_minimo_oficial_read on public.aud_comentario_minimo_oficial;
create policy aud_comentario_minimo_oficial_read
  on public.aud_comentario_minimo_oficial
  for select
  to authenticated
  using (true);

-- ============================================================================
-- ROLLBACK (reversible) — ejecutar solo si se necesita revertir:
--   drop policy if exists aud_comentario_minimo_oficial_read on public.aud_comentario_minimo_oficial;
--   alter table public.aud_comentario_minimo_oficial disable row level security;
-- ============================================================================
