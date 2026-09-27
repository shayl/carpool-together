import { createClient } from "@supabase/supabase-js";
import { decryptGroupPin } from "../src/lib/group-pin";

type GroupRecord = {
  id: string;
  name: string;
  slug: string;
  pin_ciphertext: string | null;
};

const identifier = process.argv.slice(2).join(" ").trim();
if (!identifier) {
  console.error(
    'Usage: npm run recover-pin -- <group-id, slug, or exact group name>',
  );
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SECRET_KEY;
if (!supabaseUrl || !serviceKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required.",
  );
}

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const isUuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    identifier,
  );

async function findGroups() {
  const columns = "id, name, slug, pin_ciphertext";
  if (isUuid) {
    const result = await admin
      .from("groups")
      .select(columns)
      .eq("id", identifier);
    if (result.error) throw result.error;
    return result.data as GroupRecord[];
  }

  const slugResult = await admin
    .from("groups")
    .select(columns)
    .eq("slug", identifier);
  if (slugResult.error) throw slugResult.error;
  if (slugResult.data.length) return slugResult.data as GroupRecord[];

  const nameResult = await admin
    .from("groups")
    .select(columns)
    .eq("name", identifier);
  if (nameResult.error) throw nameResult.error;
  return nameResult.data as GroupRecord[];
}

async function main() {
  const groups = await findGroups();
  if (groups.length === 0) {
    console.error(`No group matched "${identifier}".`);
    process.exit(1);
  }
  if (groups.length > 1) {
    console.error("More than one group has that name. Retry with a group ID:");
    for (const group of groups) {
      console.error(`- ${group.id}  ${group.name}`);
    }
    process.exit(1);
  }

  const group = groups[0];
  if (!group.pin_ciphertext) {
    console.error(
      `"${group.name}" uses a legacy PIN. A signed-in owner must regenerate it once before this command can recover it.`,
    );
    process.exit(1);
  }

  console.log(`Group: ${group.name}`);
  console.log(`ID:    ${group.id}`);
  console.log(`PIN:   ${decryptGroupPin(group.pin_ciphertext)}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
