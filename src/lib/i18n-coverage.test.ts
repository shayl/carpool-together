import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import { hebrew } from "./i18n";

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const location = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(location);
    return /\.(?:ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".test.ts")
      ? [location]
      : [];
  });
}

function translatedLiterals(file: string) {
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const keys: string[] = [];

  function visit(node: ts.Node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "t"
    ) {
      const [key] = node.arguments;
      if (
        key &&
        (ts.isStringLiteral(key) || ts.isNoSubstitutionTemplateLiteral(key))
      ) {
        keys.push(key.text);
      }
    }
    if (
      ts.isPropertyAssignment(node) &&
      ((ts.isIdentifier(node.name) && node.name.text === "error") ||
        (ts.isStringLiteral(node.name) && node.name.text === "error")) &&
      ts.isStringLiteral(node.initializer)
    ) {
      keys.push(node.initializer.text);
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return keys;
}

test("every literal UI translation key has a Hebrew translation", () => {
  const root = path.resolve("src");
  const dynamicUiKeys = [
    "Schedule",
    "People",
    "Places",
    "Driving balance",
    "Earlier this week",
    "Preferences",
    "Groups",
    "Group management",
    "Edit event",
    "Edit break",
    "Save plans",
    "I'll drive",
    "Hide details",
    "Month view",
    "Week view",
    "owner",
    "admin",
    "coordinator",
    "member",
    "Regular event",
    "Special event",
    "Trip or competition",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];
  const keys = [
    ...sourceFiles(root).flatMap(translatedLiterals),
    ...dynamicUiKeys,
  ];
  const missing = [...new Set(keys)]
    .filter((key) => !(key in hebrew))
    .sort();

  assert.deepEqual(missing, []);
});
