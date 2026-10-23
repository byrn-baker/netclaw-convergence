"""
ChromaDB Storage Backend for Memory MCP Server.

Provides semantic storage for session summaries with:
- PersistentClient for durability
- Metadata filtering (timestamp, entities, topics)
- Graceful degradation if unavailable
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

log = logging.getLogger("MemoryMCP.Chroma")

# Collection name
COLLECTION_NAME = "session_summaries"

# Validation constants
MAX_SUMMARY_LENGTH = 10000


def generate_id() -> str:
    """Generate a random hex ID with prefix."""
    return f"sess_{os.urandom(6).hex()}"


def utc_now() -> str:
    """Return current UTC time as ISO string."""
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class ChromaStore:
    """ChromaDB storage backend for semantic search."""

    def __init__(self, data_dir: str, embedder):
        """
        Initialize ChromaDB store.

        Args:
            data_dir: Directory for ChromaDB persistence
            embedder: Embedder instance for generating embeddings
        """
        self.data_dir = data_dir
        self.embedder = embedder
        self._client = None
        self._collection = None
        self._available = None

    def _init_client(self) -> bool:
        """
        Initialize ChromaDB client and collection.

        Returns True if successful, False otherwise.
        """
        if self._client is not None:
            return self._available or False

        try:
            import chromadb
            from chromadb.config import Settings

            chroma_dir = Path(self.data_dir) / "chroma"
            chroma_dir.mkdir(parents=True, exist_ok=True)

            log.info(f"Initializing ChromaDB at {chroma_dir}")
            self._client = chromadb.PersistentClient(
                path=str(chroma_dir),
                settings=Settings(anonymized_telemetry=False),
            )

            # Get or create collection
            self._collection = self._client.get_or_create_collection(
                name=COLLECTION_NAME,
                metadata={"hnsw:space": "cosine"},
            )

            self._available = True
            log.info(f"ChromaDB initialized with collection '{COLLECTION_NAME}'")
            return True

        except ImportError as e:
            log.warning(f"ChromaDB not available: {e}")
            self._available = False
            return False
        except Exception as e:
            log.error(f"Failed to initialize ChromaDB: {e}")
            self._available = False
            return False

    @property
    def available(self) -> bool:
        """Check if ChromaDB is available."""
        if self._available is None:
            self._init_client()
        return self._available or False

    def store_session(
        self,
        summary: str,
        entities: Optional[List[str]] = None,
        topics: Optional[List[str]] = None,
        session_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Store a session summary with embedding.

        Returns dict with id, summary_preview, entities, topics, embedding_dimensions, created_at.
        """
        # Validate summary
        if not summary or not summary.strip():
            return {"success": False, "error": {"code": "INVALID_SUMMARY", "message": "Summary cannot be empty"}}
        if len(summary) > MAX_SUMMARY_LENGTH:
            return {"success": False, "error": {"code": "INVALID_SUMMARY", "message": f"Summary exceeds {MAX_SUMMARY_LENGTH} characters"}}

        # Check availability
        if not self._init_client():
            return {"success": False, "error": {"code": "CHROMA_UNAVAILABLE", "message": "ChromaDB not available"}}

        if not self.embedder.available:
            return {"success": False, "error": {"code": "EMBEDDING_FAILED", "message": "Embedding model not available"}}

        # Generate embedding
        embedding = self.embedder.embed(summary)
        if embedding is None:
            return {"success": False, "error": {"code": "EMBEDDING_FAILED", "message": "Failed to generate embedding"}}

        # Prepare metadata
        now = utc_now()
        doc_id = session_id or generate_id()
        entities = entities or []
        topics = topics or []

        # Normalize entities to lowercase
        entities = [e.strip().lower() for e in entities if e.strip()]
        topics = [t.strip().lower() for t in topics if t.strip()]

        metadata = {
            "created_at": now,
            "entities": ",".join(entities) if entities else "",
            "topics": ",".join(topics) if topics else "",
            "session_id": session_id or doc_id,
        }

        try:
            self._collection.add(
                ids=[doc_id],
                embeddings=[embedding],
                documents=[summary],
                metadatas=[metadata],
            )

            return {
                "success": True,
                "data": {
                    "id": doc_id,
                    "summary_preview": summary[:100] + "..." if len(summary) > 100 else summary,
                    "entities": entities,
                    "topics": topics,
                    "embedding_dimensions": len(embedding),
                    "created_at": now,
                },
            }
        except Exception as e:
            log.error(f"Failed to store session: {e}")
            return {"success": False, "error": {"code": "STORE_FAILED", "message": str(e)}}

    def semantic_search(
        self,
        query: str,
        top_k: int = 5,
        min_score: float = 0.5,
        after: Optional[str] = None,
        topics: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Search sessions by semantic similarity.

        Returns dict with query, results list, count.
        """
        # Validate query
        if not query or not query.strip():
            return {"success": False, "error": {"code": "INVALID_QUERY", "message": "Query cannot be empty"}}

        if not self._init_client():
            return {"success": False, "error": {"code": "CHROMA_UNAVAILABLE", "message": "Semantic storage unavailable"}}
        if not self.embedder.available:
            return {"success": False, "error": {"code": "EMBEDDING_FAILED", "message": "Embedding model unavailable"}}
        try:
            query_embedding = self.embedder.embed(query)
        except Exception:
            query_embedding = None
        if query_embedding is None:
            return {"success": False, "error": {"code": "EMBEDDING_FAILED", "message": "Query embedding failed"}}
        try:
            if isinstance(top_k, bool) or not isinstance(top_k, int) or top_k < 1:
                raise ValueError("Invalid result limit")
            cutoff = datetime.fromisoformat(after.replace("Z", "+00:00")) if after else None
            if cutoff and cutoff.tzinfo is None:
                cutoff = cutoff.replace(tzinfo=timezone.utc)
            normalized_topics = {t.strip().lower() for t in (topics or []) if t.strip()}
        except (ValueError, TypeError, AttributeError):
            return {"success": False, "error": {"code": "INVALID_FILTER", "message": "Invalid date, topics or result limit"}}
        top_k = min(top_k, 20)
        filtered = bool(cutoff or normalized_topics)
        try:
            # Query ChromaDB
            total = self._collection.count()
            candidate_count = min(total, 200 if filtered else top_k)
            partial = filtered and total > candidate_count
            if not total:
                return {"success": True, "data": {"query": query, "results": [], "count": 0, "partial": False}}
            results = self._collection.query(
                query_embeddings=[query_embedding],
                n_results=candidate_count,
                include=["documents", "metadatas", "distances"],
            )

            # Process results
            processed_results = []
            if results["ids"] and results["ids"][0]:
                for i, doc_id in enumerate(results["ids"][0]):
                    # ChromaDB returns distance, convert to similarity score
                    # For cosine distance: similarity = 1 - distance
                    distance = results["distances"][0][i] if results["distances"] else 0
                    score = 1 - distance

                    # Filter by minimum score
                    if score < min_score:
                        continue

                    metadata = results["metadatas"][0][i] if results["metadatas"] else {}
                    document = results["documents"][0][i] if results["documents"] else ""

                    entities = metadata.get("entities", "").split(",") if metadata.get("entities") else []
                    topics_list = metadata.get("topics", "").split(",") if metadata.get("topics") else []

                    if normalized_topics and not normalized_topics.intersection(topics_list):
                        continue
                    if cutoff:
                        created = datetime.fromisoformat(metadata["created_at"].replace("Z", "+00:00"))
                        if created.tzinfo is None:
                            created = created.replace(tzinfo=timezone.utc)
                        if created < cutoff:
                            continue
                    if len(processed_results) >= top_k:
                        break
                    processed_results.append({
                        "id": doc_id,
                        "summary": document,
                        "score": round(score, 3),
                        "entities": [e for e in entities if e],
                        "topics": [t for t in topics_list if t],
                        "created_at": metadata.get("created_at"),
                    })

            return {
                "success": True,
                "data": {
                    "query": query,
                    "results": processed_results,
                    "count": len(processed_results),
                    "partial": partial,
                    "candidates_examined": candidate_count,
                    "note": "Filters applied to bounded nearest candidates; additional matches may exist" if partial else "",
                },
            }

        except Exception:
            log.exception("Semantic search failed")
            return {"success": False, "error": {"code": "SEARCH_FAILED", "message": "Semantic query failed; no absence conclusion is available"}}

    def get_stats(self) -> Dict[str, Any]:
        """Get collection statistics."""
        if not self._init_client():
            return {"success": False, "error": {"code": "CHROMA_UNAVAILABLE", "message": "ChromaDB not available"}}

        try:
            count = self._collection.count()
            return {
                "success": True,
                "data": {
                    "collection": COLLECTION_NAME,
                    "document_count": count,
                },
            }
        except Exception as e:
            return {"success": False, "error": {"code": "STATS_FAILED", "message": str(e)}}
