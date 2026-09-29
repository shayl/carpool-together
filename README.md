# Carpool Together

A private, multi-group carpool planning application for teams, clubs,
activities, neighborhoods, and other trusted communities.

This repository is independent from Kangs Carpool. It has its own Git history,
deployment configuration, and Supabase schema. Never point it at the Kangs
Carpool database or reuse that application's credentials.

## Current functionality

- Create and switch between private database-backed groups.
- Use group names in Hebrew, English, or other writing systems.
- Let group owners permanently delete groups with explicit confirmation.
- Register and create a first group without deployment-level secrets.
- Switch between English and Hebrew with persistent RTL localization.
- Protect each group with a private phone roster and hashed shared PIN.
- Let owners import roster members from pasted name/phone data.
- Manage household guardians, riders, addresses, and absences.
- Choose household and venue addresses with autocomplete or a draggable map pin.
- Create reusable venues, recurring schedules, and one-time events.
- Track separate outbound and return rides with named drivers.
- Edit daily attendance and ride needs from the weekly schedule.
- View weekly and monthly calendars, with URL-backed navigation state.
- Receive live cross-device schedule updates through Supabase Realtime.
- Open optimized routes in Google Maps, Apple Maps, or Waze.
- Share weekly status and group invitations through WhatsApp.
- Use cached read-only screens while temporarily offline.
- Install the PWA and opt into per-device driver reminders.
- Define tenant-scoped database tables and Row Level Security.
- Authenticate rostered members with a phone number and shared group PIN.
- Explain service limitations on the About page.

## Run locally

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`. Use `localhost` consistently during development
because authentication cookies do not carry over to `127.0.0.1`. Loopback-IP
browser visits are replaced with the canonical local hostname.

## App icons

`public/icon.svg` is the source artwork for the happy carpool icon. Keep the
192px and 512px PNGs in `public`, the 180px `src/app/apple-icon.png`, and the
16px/32px/48px `src/app/favicon.ico` in sync when changing the artwork.
The full-bleed background and centered car also support maskable home-screen icons.

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
5. Enable anonymous sign-ins in Supabase Auth.
6. Add the project's server-only secret key as `SUPABASE_SECRET_KEY`.
7. Open the app and use **Register and create a group** to create the first
   owner, roster entry, and group.
8. Keep `AUTH_RATE_LIMIT_SECRET` private; it protects sign-in and registration
   throttling identifiers.

## Current limitations

- Route ordering uses geographic coordinates rather than live traffic times.
- Apple Maps and Waze open multi-stop routes one destination at a time.
- Offline mode is read-only until the device reconnects.
- The About-page notice is not a substitute for attorney-reviewed Terms of
  Service, a Privacy Policy, or legally required consent language.
