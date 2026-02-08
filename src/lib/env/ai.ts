export type AIEnvDoc = {
  key: string;
  description: string;
  where_to_get: string;
  example_value: string;
  is_secret: boolean;
};

export type AIGenerateOptions = {
  apiKey: string;
  model: string;
  projectHint?: string;
  contexts: Record<string, { file: string; line: number; snippet: string }[]>;
  keys: string[];
};

const JSON_SCHEMA = {
  name: "env_docs",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            key: { type: "string" },
            description: { type: "string" },
            where_to_get: { type: "string" },
            example_value: { type: "string" },
            is_secret: { type: "boolean" },
          },
          required: [
            "key",
            "description",
            "where_to_get",
            "example_value",
            "is_secret",
          ],
        },
      },
    },
    required: ["items"],
  },
} as const;

function buildInput(opts: AIGenerateOptions) {
  const lines = opts.keys.map((k) => {
    const ctx = opts.contexts[k]?.[0];
    const seenAt = ctx ? `${ctx.file}:${ctx.line}` : "unknown";
    const snippet = ctx ? ctx.snippet : "";
    return `- ${k}\n  seen_at: ${seenAt}\n  snippet: ${snippet}`;
  });

  const system = [
    "You generate documentation for environment variables.",
    "Return ONLY JSON that matches the provided JSON Schema.",
    "Do not include markdown or extra text.",
    "Never output real secrets. Use safe placeholders.",
    "Keep descriptions short and practical.",
    "where_to_get must be actionable (dashboard, secret manager, CI, local service, etc.).",
  ].join(" ");

  const user = [
    opts.projectHint ? `Project hint: ${opts.projectHint}` : "",
    "Variables:",
    ...lines,
  ]
    .filter(Boolean)
    .join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

function extractTextFromResponses(data: unknown): string {
  if (typeof (data as { output_text?: string })?.output_text === "string") {
    const t = (data as { output_text: string }).output_text.trim();
    if (t) return t;
  }

  const out = (data as { output?: unknown[] })?.output;
  if (Array.isArray(out)) {
    for (const item of out) {
      const content = (item as { content?: unknown[] })?.content;
      if (!Array.isArray(content)) continue;
      for (const c of content) {
        const text = (c as { text?: string })?.text;
        if (typeof text === "string" && text.trim()) return text;
      }
    }
  }
  return "";
}

function tryParseJsonLoose(raw: string): { items?: unknown[] } | null {
  try {
    return JSON.parse(raw) as { items?: unknown[] };
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]) as { items?: unknown[] };
    } catch {
      return null;
    }
  }
}

export async function generateEnvDocsWithOpenAI(
  opts: AIGenerateOptions,
): Promise<AIEnvDoc[]> {
  const input = buildInput(opts);

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model,
      input,
      text: {
        format: {
          type: "json_schema",
          ...JSON_SCHEMA,
        },
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI request failed (${res.status}): ${text}`);
  }

  const data: unknown = await res.json();
  const raw = extractTextFromResponses(data).trim();

  const parsed = tryParseJsonLoose(raw);
  if (!parsed) {
    throw new Error(
      "AI output was not valid JSON. Try again, or use a different model.",
    );
  }

  const items = Array.isArray(parsed?.items) ? parsed.items : [];
  return items
    .map((x: unknown) => {
      const o = x as Record<string, unknown>;
      return {
        key: String(o?.key ?? ""),
        description: String(o?.description ?? ""),
        where_to_get: String(o?.where_to_get ?? ""),
        example_value: String(o?.example_value ?? ""),
        is_secret: Boolean(o?.is_secret),
      };
    })
    .filter((x): x is AIEnvDoc => x.key.length > 0);
}
