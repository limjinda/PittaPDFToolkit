import { pdfjs } from "./pdfWorker";
import type { PDFDocumentProxy } from "pdfjs-dist";

// Cache loaded pdf.js documents by source doc ID to avoid re-parsing
const docCache = new Map<string, PDFDocumentProxy>();

// Cache verified passwords by file size + content prefix fingerprint
const passwordCache = new Map<string, string>();

type PasswordPromptFn = (docId: string, reason: number) => Promise<string | null>;

let passwordPromptFn: PasswordPromptFn | null = null;

/** Register global password callback from the React UI */
export function registerPasswordPrompt(fn: PasswordPromptFn) {
  passwordPromptFn = fn;
}

/** Generates a unique fingerprint for a PDF byte stream to safely cache passwords */
function getPasswordCacheKey(bytes: Uint8Array): string {
  let prefix = "";
  const len = Math.min(bytes.length, 64);
  for (let i = 0; i < len; i++) {
    prefix += bytes[i].toString(16);
  }
  return `${bytes.length}_${prefix}`;
}

/**
 * Load a PDF from raw bytes using pdf.js.
 * Caches the result by docId — same bytes won't be re-parsed.
 */
export async function loadPdfDoc(
  docId: string,
  bytes: Uint8Array
): Promise<PDFDocumentProxy> {
  if (docCache.has(docId)) {
    return docCache.get(docId)!;
  }

  const data = new Uint8Array(bytes);
  const cacheKey = getPasswordCacheKey(data);
  let password = passwordCache.get(cacheKey) || "";
  let reason = 1; // 1 = need password, 2 = wrong password

  while (true) {
    try {
      const loadingTask = pdfjs.getDocument({
        data: data.slice(0),
        password,
      } as any);
      const doc = await loadingTask.promise;
      
      // Successfully loaded: cache the correct password for future renders of this file
      if (password) {
        passwordCache.set(cacheKey, password);
      }
      
      docCache.set(docId, doc);
      return doc;
    } catch (err: any) {
      if (err && err.name === "PasswordException") {
        // If cached password failed, evict it
        passwordCache.delete(cacheKey);

        if (passwordPromptFn) {
          const pass = await passwordPromptFn(docId, reason);
          if (pass === null) {
            throw new Error("Password entry cancelled.");
          }
          password = pass;
          reason = 2; // subsequent prompts show wrong password warning
        } else {
          throw new Error("Document is password protected, but no password prompt is registered.");
        }
      } else {
        throw err;
      }
    }
  }
}

/** Evict a document from cache */
export function evictPdfDoc(docId: string): void {
  docCache.delete(docId);
}

/** Clear all cached documents */
export function clearPdfCache(): void {
  docCache.clear();
  passwordCache.clear();
}
