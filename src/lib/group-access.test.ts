import assert from "node:assert/strict";
import test from "node:test";
import bcrypt from "bcryptjs";
import {
  matchingRosterEntries,
  type RosterEntry,
} from "./group-access";

test("matches a roster entry only when its group PIN is correct", async () => {
  const entry: RosterEntry = {
    id: "entry-a",
    group_id: "group-a",
    display_name: "Alex",
    role: "member",
  };
  const hashes = new Map([
    ["group-a", await bcrypt.hash("2468", 4)],
    ["group-b", await bcrypt.hash("1357", 4)],
  ]);

  assert.deepEqual(await matchingRosterEntries([entry], hashes, "2468"), [
    entry,
  ]);
  assert.deepEqual(await matchingRosterEntries([entry], hashes, "0000"), []);
});

test("returns every match so ambiguous group PINs can be rejected", async () => {
  const entries: RosterEntry[] = [
    {
      id: "entry-a",
      group_id: "group-a",
      display_name: "Alex",
      role: "member",
    },
    {
      id: "entry-b",
      group_id: "group-b",
      display_name: "Alex",
      role: "coordinator",
    },
  ];
  const sharedHash = await bcrypt.hash("2468", 4);

  assert.equal(
    (await matchingRosterEntries(
      entries,
      new Map([
        ["group-a", sharedHash],
        ["group-b", sharedHash],
      ]),
      "2468",
    )).length,
    2,
  );
});
