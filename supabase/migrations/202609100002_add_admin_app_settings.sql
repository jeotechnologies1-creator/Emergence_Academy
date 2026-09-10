-- Central, non-secret application settings managed by CEO and admin users.
-- Credentials, API keys, and Edge Function secrets must remain in Supabase
-- secrets/environment variables and are deliberately not stored here.

alter table public.school_settings
  add column if not exists app_settings jsonb not null default '{}'::jsonb;

comment on column public.school_settings.app_settings is
  'Public operational settings such as school profile, contact details, timezone, and reminder preferences. Never store secrets here.';
