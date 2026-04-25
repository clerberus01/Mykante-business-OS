# Supabase Workspace

This directory stores SQL migrations, seeds, and operational notes for the Supabase migration.

Conventions:

- `migrations/` contains ordered SQL files
- migrations are append-only
- schema changes are tracked before frontend wiring
- security rules must be implemented with RLS, not frontend checks
