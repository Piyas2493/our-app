// A handful of route modules read process.env at import time (e.g. Gemini
// client construction) and throw immediately if the key is missing. Tests
// always mock the Gemini SDK itself, but the module-level check still runs
// on import, so a dummy value keeps that import from throwing.
process.env.GEMINI_API_KEY ||= "test-gemini-api-key";
process.env.DATABASE_URL ||= "file:./test.db";
