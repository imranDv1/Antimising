import crypto from "crypto";

// Encrypt note bodies at rest using AES-256-GCM.
// The encryption key is loaded from NOTE_ENCRYPTION_KEY and never stored in
// the database or sent to the client. Read/decrypt only happens server-side
// after the caller has been authorized.

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // recommended 96-bit IV for GCM
const TAG_LENGTH = 16; // 128-bit GCM authentication tag
const KEY_LENGTH = 32; // 32 bytes = AES-256

function getNoteEncryptionKey(): Buffer {
  const key = process.env.NOTE_ENCRYPTION_KEY;

  if (!key) {
    // Fail closed: never silently store plaintext when the key is missing.
    throw new Error("NOTE_ENCRYPTION_KEY environment variable is not set");
  }

  if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
    return Buffer.from(key, "hex");
  }

  const decoded = Buffer.from(key, "base64");
  if (decoded.length === KEY_LENGTH) return decoded;

  // Fallback: derive a 32-byte key from the secret string.
  return crypto.scryptSync(key, "rivorea-notes-note-v1", KEY_LENGTH);
}

/**
 * Encrypt an arbitrary JSON-serializable payload.
 * Returns a single opaque encoded value: base64(iv) || base64(tag) || base64(ciphertext)
 * A fresh random nonce is generated for every call.
 */
export function encryptNotePayload(data: unknown): string {
  const plain = Buffer.from(JSON.stringify(data), "utf8");
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getNoteEncryptionKey();

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

/**
 * Decrypt a payload produced by encryptNotePayload.
 * Throws if the payload is malformed or the ciphertext was tampered with
 * (GCM authentication failure). It never returns partial/corrupt data.
 */
export function decryptNotePayload(payload: string): unknown {
  const combined = Buffer.from(payload, "base64");
  if (combined.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error("Invalid encrypted note payload");
  }

  const iv = combined.subarray(0, IV_LENGTH);
  const tag = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, getNoteEncryptionKey(), iv);
  decipher.setAuthTag(tag);

  let decrypted: Buffer;
  try {
    decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    // GCM authentication failed (tampered ciphertext / wrong key).
    // Normalize to a safe generic error — never expose ciphertext or details.
    throw new Error("Invalid encrypted note payload");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(decrypted.toString("utf8"));
  } catch {
    // Never echo decrypted content or parse details in errors.
    throw new Error("Invalid encrypted note payload");
  }
  return parsed;
}

type NoteBodyPayload = {
  content: unknown;
  links: string[];
};

/**
 * Encrypt the note body. The stored blob never contains plaintext: it holds
 * the Tiptap content plus the extracted external links in one encrypted value.
 */
export function encryptNoteBody(content: unknown, links: string[]): string {
  return encryptNotePayload({ content, links });
}

/**
 * Decrypt a note body.
 *
 * Accepts ONLY the encrypted base64 format produced by encryptNoteBody.
 * Fails closed on any other input: legacy/plaintext values, malformed blobs,
 * or tampered ciphertext all raise a generic error and are never returned as
 * note content. No encryption details or ciphertext leak into errors.
 */
export function decryptNoteBody(payload: string | null | undefined): NoteBodyPayload {
  if (payload == null || payload === "") {
    return { content: null, links: [] };
  }

  // Fail closed: a plaintext blob is not a valid payload, never fall back to it.
  if (payload.startsWith("{") || payload.startsWith("[")) {
    throw new Error("Invalid encrypted note payload");
  }

  const decrypted = decryptNotePayload(payload);
  if (typeof decrypted !== "object" || decrypted === null) {
    throw new Error("Invalid encrypted note payload");
  }

  const body = decrypted as Partial<NoteBodyPayload>;
  if (body.links !== undefined && !Array.isArray(body.links)) {
    throw new Error("Invalid encrypted note payload");
  }

  return {
    content: body.content ?? null,
    links: Array.isArray(body.links) ? body.links : [],
  };
}