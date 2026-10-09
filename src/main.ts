import { collectCitations } from "./citation_service.ts";

const input = {
  title: "TypeScript build notes",
  body: "Model build events and release diagnostics in one research record.",
  sourceUrl: "https://example.com/build-notes",
  release: "2026-09"
};

collectCitations(input)
  .then((citations) => console.log(JSON.stringify({ citations, count: citations.length }, null, 2)))
  .catch((error: Error) => { console.error(error.message); process.exitCode = 1; });
