-- Group PINs are gone. People now sign in with their own phone and personal
-- code (see 20261003000000_account_identity_and_shared_family.sql), and a
-- group is joined by an organizer adding your phone to its roster -- so a
-- group no longer holds a shared secret at all.
--
-- Applied last, once no application code reads these objects.

-- Every one of these mints a group around a PIN. `create_group_for_account`
-- replaces them; `bootstrap_first_group` is replaced by the bootstrap route
-- calling that same function.
drop function if exists public.bootstrap_first_group(
  text, text, text, text, text, uuid
);
drop function if exists public.create_additional_group(
  text, text, text, text, text, uuid
);
drop function if exists public.create_additional_group_with_generated_pin(
  text, text, text, text, text, text, uuid
);
drop function if exists public.create_additional_group_with_recoverable_pin(
  text, text, text, text, text, text, text, uuid
);
drop function if exists public.create_group(text, text, text, text);
drop function if exists public.register_group(
  text, text, text, text, text, uuid, text
);
drop function if exists public.register_group_with_generated_pin(
  text, text, text, text, text, text, uuid, text
);
drop function if exists public.register_group_with_recoverable_pin(
  text, text, text, text, text, text, text, uuid, text
);

-- The unique index exists only to keep generated PINs distinct across groups.
drop index if exists public.groups_pin_fingerprint_key;

alter table public.groups
  drop column if exists pin_hash,
  drop column if exists pin_fingerprint,
  drop column if exists pin_ciphertext;

-- Rate-limited anonymous group self-registration, which no longer exists:
-- only someone already on a roster can sign in, and they create groups as a
-- known account. The phone+IP and per-account login limits live in
-- auth_login_attempts, which stays.
drop table if exists public.group_registration_attempts;
