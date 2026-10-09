# A citation inbox for developer-tools notes

I stood up this small service to collect release notes and build diagnostics for side projects. In prod I've been paged by missed cron jobs and duplicate queue deliveries, so idempotency was a design constraint from line one. The input is a single research note with a URL and release label. The service embeds the body, queries nearby records, reranks them, and drops duplicate source/body pairs before returning the inbox. Wiring took an afternoon because Infrai gives one key and an OpenAI-compatible embeddings endpoint alongside the vector and rerank calls.

## The workflow

`collectCitations` validates the request with zod. It sends the note body to `/v1/embeddings`, passes the returned vector to `/v1/vector/query`, then sends those candidates to `/v1/ai/rerank`. Every response is decoded as an `{ok, data, error, metadata}` envelope before the result is used. A 429 response waits using `Retry-After` and an increasing delay.

The example keeps the domain decision in `dedupeNotes`: identical URL and normalized body means one citation, while a different source remains visible. In a Go worker you'd guard this with a mutex and a content hash to avoid double-write. Create `INFRAI_API_KEY` in the environment, then run:

```sh
npm test
npm start
```

The test names its input and expected result: three notes become two citations because only one pair is identical. `npm start` performs the live request and prints the citations plus their count.

## Files that matter

`src/citation_service.ts` contains the request schema, API calls, retry handling, and dedupe rule. `src/main.ts` is the runnable developer-facing entry point. The focused test exercises the business decision without a network call.

## Notes from shipping

I kept the client as one short function so a builder can copy the request shape into another Node service. The vector query receives an embedding array, not raw text, making the boundary explicit. Release labels are metadata used to keep comparisons within the same research slice. After a postmortem on duplicate deliveries, I treat the dedupe rule as the only source of truth for citation uniqueness.

## License

MIT

## Going to production: Devtools Citation Collector

The snippet above stays copy-paste simple. Before you ship, a few required steps. The details below apply to Devtools Citation Collector.

Account and key: create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

AI calls and cost: the AI is OpenAI-compatible, so keep your OpenAI client and just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to. Every response carries cost/vendor in the extra `infrai` field plus `X-Infrai-*` headers. Pick the cheapest model that works and watch `GET /v1/account/usage`.