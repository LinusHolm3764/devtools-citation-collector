import assert from "node:assert/strict";
import { dedupeNotes } from "../src/citation_service.ts";

const note = { title: "Build", body: "Release event", sourceUrl: "https://example.com/a", release: "1.0" };
const result = dedupeNotes([note, { ...note }, { ...note, sourceUrl: "https://example.com/b" }]);
assert.equal(result.length, 2);
assert.equal(result[0].sourceUrl, "https://example.com/a");
console.log("dedupe decision preserved distinct sources");
