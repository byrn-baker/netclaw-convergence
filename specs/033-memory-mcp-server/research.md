# Research: Hybrid memory

**Retrospective reconstruction — 2026-10-30.** This artifact was added during
spec 1011 maintenance from repository evidence at `09748c37`. It is not evidence
that planning preceded the historical implementation, and it claims no new runtime
verification. Original documents and their status statements remain unchanged.

## Evidence reviewed

- [specs/033-memory-mcp-server/plan.md](../../specs/033-memory-mcp-server/plan.md)
- [specs/033-memory-mcp-server/tasks.md](../../specs/033-memory-mcp-server/tasks.md)
- [mcp-servers/memory-mcp/README.md](../../mcp-servers/memory-mcp/README.md)
- [mcp-servers/memory-mcp/storage/sqlite_store.py](../../mcp-servers/memory-mcp/storage/sqlite_store.py)
- [mcp-servers/memory-mcp/storage/chroma_store.py](../../mcp-servers/memory-mcp/storage/chroma_store.py)

## Decisions and limits

The original plan separates temporal facts/decisions in SQLite from semantic
session recall in ChromaDB, keeping embeddings local and optional. The current
server README explicitly describes graceful degradation without embeddings and
shared storage only when processes use the same accessible absolute directory.
The original Docker/server.py plan and current packaged layout differ; use current
source for installation, not historical filenames. Existing task checkmarks are
historical claims. This reconstruction ran no persistence, embedding-download or
cross-member test; those need separate fixture/runtime evidence.
