# Global Codex Guidance

## Text Encoding Safety

- When editing files that contain Chinese or any other non-ASCII text, preserve the exact existing characters and byte content.
- Use UTF-8-aware, byte-safe reads and writes for these files; do not rely on console output or lossy shell replacements when text may be encoded incorrectly.
- Never accept `???`, `??`, or any placeholder replacement as a valid result for user-visible text. If placeholders appear, treat that as a failed write and restore from a known-good source before continuing.
- After any edit that touches non-ASCII UI copy, verify the file content round-trips correctly and the UI renders the original text as intended.
