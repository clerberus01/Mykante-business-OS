# Services Layer

This folder holds the domain services used by the Supabase data layer.

Current modules:

- `clients`
- `projects`
- `finance`
- `proposals`
- `shared`

The current design is:

- repositories per domain
- mapper helpers to convert Postgres rows into the existing frontend types
- one hook layer under `src/hooks/supabase` mirroring the existing page contracts
- page wiring kept incremental to reduce migration risk

The goal is to keep the page and component design intact while keeping Supabase as the single active data source.
