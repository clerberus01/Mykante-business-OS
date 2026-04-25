# Services Layer

This folder will hold the domain services used during the Firebase to Supabase migration.

Current modules:

- `clients`
- `projects`
- `finance`
- `proposals`
- `shared`

The current design is:

- repositories per domain
- mapper helpers to convert Postgres rows into the existing frontend types
- one hook layer under `src/hooks/supabase` mirroring the current Firebase hook API
- no page wiring yet, to keep the migration incremental and low-risk

The goal is to keep the page and component design intact while replacing the current data source.
