export interface EnvVarEnriched {
  key: string;
  description: string;
  example: string;
  /** Step-by-step setup instructions */
  steps?: string[];
}

export interface EnvAiOptions {
  provider: "openai" | "google";
  model: string;
  apiKey: string;
}

/**
 * Use AI to generate descriptions and example values for env vars.
 */
export async function enrichEnvVarsWithAi(
  keys: string[],
  options: EnvAiOptions,
): Promise<EnvVarEnriched[]> {
  if (keys.length === 0) {
    return [];
  }

  const prompt = `You are helping generate a .env.example file. For each environment variable name below, provide:
1. "description" - brief one-line summary (what it's used for)
2. "example" - realistic placeholder value (not real secrets)
3. "steps" - array of step-by-step setup instructions (e.g. ["Step 1: Get your API key from https://...", "Step 2: Create a new key in the dashboard", "Step 3: Paste the key here"])

Return a JSON array only, no markdown. Format: [{"key":"VAR_NAME","description":"...","example":"...","steps":["Step 1: ...","Step 2: ..."]}]
Keep each step under 80 chars. Use 2-4 steps per variable. Examples: "localhost", "5432", "sk-xxx", "https://api.example.com".

Variables:
${keys.join("\n")}`;

  if (options.provider === "openai") {
    return callOpenAI(prompt, options.model, options.apiKey);
  }
  return callGoogle(prompt, options.model, options.apiKey);
}

async function callOpenAI(
  prompt: string,
  model: string,
  apiKey: string,
): Promise<EnvVarEnriched[]> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("No response from OpenAI");

  return parseJsonResponse(content);
}

async function callGoogle(
  prompt: string,
  model: string,
  apiKey: string,
): Promise<EnvVarEnriched[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3 },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google AI API error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No response from Google AI");

  return parseJsonResponse(text);
}

function parseJsonResponse(content: string): EnvVarEnriched[] {
  const cleaned = content.replace(/```json\n?|\n?```/g, "").trim();
  const parsed = JSON.parse(cleaned) as unknown;
  if (!Array.isArray(parsed)) throw new Error("AI did not return an array");

  return parsed.map((item: unknown) => {
    const obj = item as Record<string, unknown>;
    const stepsRaw = obj.steps;
    const steps = Array.isArray(stepsRaw)
      ? stepsRaw.map((s) => String(s)).filter(Boolean)
      : undefined;
    return {
      key: String(obj.key ?? ""),
      description: String(obj.description ?? ""),
      example: String(obj.example ?? ""),
      steps,
    };
  });
}
