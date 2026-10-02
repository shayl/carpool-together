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

### Simplified task flows

Rides starts with the week, highlights the next event, and shows the driver or
missing coverage for **each direction**. In the current week, upcoming events
come first and past events remain under **Earlier this week**; other weeks
stay chronological. **I'll drive** claims a ride for the
signed-in adult; **Choose another driver** remains in ride details. **We're
driving** filters claimed rides, not every event a family attends. Use **Change
plans** or select a child/event in My family to save attendance and independent
outbound/return needs together.

Next up uses event wall-clock dates/times in the device's local timezone and
updates each minute. An ongoing event stays highlighted until its end time;
at that time it moves into history. If no end time is provided, its start
time is the cutoff. Events have no timezone field in the current app-data
contract, so this is not a cross-timezone conversion.

Team organizes existing tools into **Schedule**, **People**, **Places**, and
**Driving balance**. Add event opens a one-time/repeating choice; authorized
roster, household, photo, and role actions remain under People. Settings opens
focused Preferences, Groups, Group management, and Help/privacy pages. Language
selection is available in Preferences and on sign-in. Verified group selection
is remembered on the device and checked against current memberships.

### Local sample preview (no backend required)

```powershell
npm ci
npm run dev -- --hostname localhost --port 3100
```

Open `http://localhost:3100/preview`. This development-only route reuses the
real app components with clearly labeled synthetic groups, adults, riders,
and events. Claims and attendance update isolated in-memory state and reset
on reload. Organizer/account/address saves, route launches, notifications,
map lookup, and installation are disabled in the demo; their real flows
remain available in the authenticated app. The preview creates no auth
session, API requests, database writes, or realtime subscriptions. It returns
not found outside development and does not bypass authentication on `/` or
any API route.

To validate a production build while keeping the development preview running,
set `CARPOOL_BUILD_DIR=build` for both `npm run build` and `npm start` in a
separate shell. This uses the ignored `build` directory instead of overwriting
the development server's `.next` output. Backend configuration is still
required for production app routes; the preview is never enabled there.

## App icons

`public/icon.svg` is the source artwork for the happy carpool icon. Keep the
192px and 512px PNGs in `public`, the 180px `src/app/apple-icon.png`, and the
16px/32px/48px `src/app/favicon.ico` in sync when changing the artwork.
The full-bleed background and centered car also support maskable home-screen icons.

## Validate

```powershell
npx next typegen
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
