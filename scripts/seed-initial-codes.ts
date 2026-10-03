import { hashPersonalCode, initialCodeFromPhone } from "../src/lib/personal-code";

// The account migration writes a placeholder hash that no code can match, so
// nobody can sign in until real hashes are written. Each account's first code
// is the last six digits of its own phone -- derivable by its owner, so there
// is nothing to hand out -- and must be changed on first use.
//
// bcrypt is not available inside Postgres here, so this prints the UPDATE
// statements instead of connecting: pipe them into psql. That also keeps the
// script runnable on Node 20, where supabase-js has no native WebSocket.
//
//   npm run seed-codes -- "+14255398809" "+972542341685" | psql "$DATABASE_URL"
//
// Pass the phone numbers to seed, or none to print usage. Re-running is safe:
// each statement only matches rows still holding the placeholder.

const PLACEHOLDER = "pending-seed";

function quote(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

async function main() {
  const phones = process.argv.slice(2).filter(Boolean);
  if (!phones.length) {
    console.error(
      'Usage: npm run seed-codes -- "<phone>" ["<phone>" ...] | psql "$DATABASE_URL"',
    );
    console.error(
      "Tip: list the phones with  select phone from accounts where code_hash = 'pending-seed';",
    );
    process.exit(1);
  }

  console.log("begin;");
  for (const phone of phones) {
    const code = initialCodeFromPhone(phone);
    const hash = await hashPersonalCode(code);
    console.log(
      `update public.accounts set code_hash = ${quote(hash)}, ` +
        `must_change_code = true, updated_at = now() ` +
        `where phone = ${quote(phone)} and code_hash = ${quote(PLACEHOLDER)};`,
    );
    console.error(`${phone}\t${code}`);
  }
  console.log("commit;");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
