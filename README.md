# Carpool Together

A private, multi-group carpool planning application for teams, clubs,
activities, neighborhoods, and other trusted communities.

This repository is independent from Kangs Carpool. It has its own Git history,
deployment configuration, and Supabase schema. Never point it at the Kangs
Carpool database or reuse that application's credentials.

## Current functionality

- Switch between private groups without mixing roster or plan state.
- Keep group-specific identity, theme, participants, drivers, and seat capacity.
- Import selected participants from pasted CSV data.
- Send validated requests to a server-side suggestion endpoint.
- Produce deterministic, capacity-aware trips and explain uncovered riders.
- Define tenant-scoped database tables and Row Level Security.
- Explain service limitations on the About page.

The interface currently uses fictional in-memory data. The SQL migration is
unapplied until a dedicated Carpool Together Supabase project is provisioned.

## Run locally

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`. The current in-memory experience does not require
environment variables or a database.

## Validate

```powershell
npm run typecheck
npm test
npm run lint
npm run build
```

## Provision the isolated backend

1. Create a new Supabase project for Carpool Together.
2. Copy `.env.example` to `.env.local` and add only that project's values.
3. Review `supabase/migrations/20260924000000_initial_schema.sql`.
4. Apply the migration only to the Carpool Together project.
5. Add verified authentication and a server-only data access layer before
   replacing the fictional in-memory data.

## Current limitations

- Coordinates and meeting points are fictional.
- Straight-line distance stands in for a road-time matrix provider.
- Imported data is held only in React state and resets on refresh.
- Authentication, invitations, consent capture, persistence, route ordering,
  and driver acceptance are represented in the schema but are not wired into
  the application yet.
- Suggestions are drafts, not ride commitments.
- The About-page notice is not a substitute for attorney-reviewed Terms of
  Service, a Privacy Policy, or legally required consent language.
