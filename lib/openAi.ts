import { GoogleGenerativeAI } from "@google/generative-ai";

if (!process.env.GEMINI_API_KEY) {
  throw new Error("❌ Missing GEMINI_API_KEY in environment variables");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const PRIMARY_MODEL = "gemini-3.8-flash";
const FALLBACK_MODELS = ["gemini-3.5-flash", "gemini-flash-latest", "gemini-2.5-flash"];

const SYSTEM_INSTRUCTION = [
  "You are NoteBuddy, the AI writing assistant built into AntiMising, a professional notes application.",
  "You help users draft, structure, edit, summarize, and polish their notes.",
  "Stay on topic: if a request has nothing to do with notes or writing, briefly say you can only help with notes.",
  "Tone: professional, clear, and concise — a capable writing partner, never chatty, casual, or overly familiar.",
  "Always reply in the language the user writes in.",
  "Response rules:",
  "- Start with the answer or the content itself. Never restate the question or echo the note title.",
  "- Keep replies short by default; expand only when the writing task genuinely needs it.",
  "- Format note content as plain text: paragraphs separated by blank lines; simple numbered (1.) or dashed (-) list lines are allowed; put code in fenced blocks with the language tag (```lang).",
  "- Do not use markdown headings, bold, italics, or other markdown symbols in note content.",
  "- When rewriting or improving text, return only the final text — no commentary about the changes.",
  "- If important details are missing, make reasonable assumptions and continue instead of asking many questions.",
].join("\n");

/**
 * Stream generated note content for a title/prompt using Google Gemini.
 * Yields text chunks as they arrive so the UI can render progressively.
 *
 * If the primary model is temporarily overloaded (503/429), retries a couple
 * of times before falling back to more stable models so users are not left
 * with a generic error during demand spikes.
 */
export async function* streamNoteBody(title: string): AsyncGenerator<string> {
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const candidates = [PRIMARY_MODEL, ...FALLBACK_MODELS];
  let lastError: unknown;

  for (const modelName of candidates) {
    let started = false;
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: SYSTEM_INSTRUCTION,
        generationConfig: {
          maxOutputTokens: 1024,
          temperature: 0.7,
        },
      });

      const { stream } = await model.generateContentStream(title);

      for await (const chunk of stream) {
        started = true;
        const text = chunk.text();
        if (text) yield text;
      }
      return;
    } catch (error) {
      const status = (error as { status?: number })?.status;
      const transient = status === 503 || status === 429;
      if (started || !transient) {
        lastError = error;
        break;
      }
      lastError = error;
      console.warn(
        `AI model ${modelName} unavailable (${status}), falling back…`
      );
      await sleep(400);
    }
  }

  console.error("❌ Error in streamNoteBody:", lastError);
  throw new Error("Failed to generate note body");
}
