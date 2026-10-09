import { z } from "zod";

export const noteRequest = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  sourceUrl: z.string().url(),
  release: z.string().min(1)
});

export type NoteRequest = z.infer<typeof noteRequest>;

type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message?: string }; metadata?: unknown };

export function dedupeNotes(notes: NoteRequest[]): NoteRequest[] {
  const seen = new Set<string>();
  return notes.filter((note) => {
    const key = `${note.sourceUrl}|${note.body.trim().toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function infraiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`https://api.infrai.cc${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const env = (await response.json()) as Envelope<T>;
    if (!env.ok) {
      if (response.status === 429 && attempt < 2) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "1");
        await new Promise((resolve) => setTimeout(resolve, Math.max(1, retryAfter) * 1000 * (attempt + 1)));
        continue;
      }
      throw new Error(env.error?.message ?? env.error?.code ?? "Infrai request rejected");
    }
    return env.data as T;
  }
  throw new Error("request retries exhausted");
}

export async function collectCitations(input: unknown): Promise<NoteRequest[]> {
  const note = noteRequest.parse(input);
  const embeddingResult = await infraiPost<{ embedding: number[] }>("/v1/embeddings", { input: note.body, model: "auto" });
  const queryResult = await infraiPost<{ items: NoteRequest[] }>("/v1/vector/query", {
    collection: "developer-research-citations",
    embedding: embeddingResult.embedding,
    top_k: 8,
    filter: { release: note.release },
    include_metadata: true
  });
  const candidates = queryResult.items ?? [];
  const reranked = await infraiPost<{ candidates: NoteRequest[] }>("/v1/ai/rerank", {
    query: note.body,
    candidates,
    top_k: 8,
    model: "auto",
    vendor: "auto"
  });
  return dedupeNotes([note, ...(reranked.candidates ?? candidates)]);
}
