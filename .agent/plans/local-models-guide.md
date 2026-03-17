# Local Models Configuration Guide

All changes are in `backend/.env` only. Restart the backend after any changes.

---

## Local Reranking

```bash
RERANK_ENABLED=true
RERANK_PROVIDER=local
RERANK_MODEL=cross-encoder/ms-marco-MiniLM-L-6-v2
RERANK_TOP_N=5
```

Model downloads automatically (~80MB) on first rerank call. No API key needed. Runs on CPU.

---

## Local LLM (Ollama)

```bash
# 1. Install Ollama: https://ollama.com
# 2. Pull a model: ollama pull llama3.1
LLM_BASE_URL=http://localhost:11434/v1
LLM_API_KEY=ollama
LLM_MODEL=llama3.1
```

Other compatible servers: **LM Studio** (`http://localhost:1234/v1`) and **vLLM** — same pattern, just change the URL.

---

## Local Embeddings (Ollama)

```bash
# ollama pull nomic-embed-text
EMBEDDING_BASE_URL=http://localhost:11434/v1
EMBEDDING_API_KEY=ollama
EMBEDDING_MODEL=nomic-embed-text
EMBEDDING_DIMENSIONS=768
```

**After changing embedding model**, you must also:
1. Run in Supabase SQL editor: `SELECT resize_embedding_column(768);`
2. Re-upload all your documents (old embeddings are incompatible with a different dimension)

---

## Common Embedding Dimension Reference

| Model | Provider | Dimensions |
|-------|----------|-----------|
| `text-embedding-3-small` | OpenAI | 1536 |
| `nomic-embed-text` | Ollama | 768 |
| `mxbai-embed-large` | Ollama | 1024 |
| `all-MiniLM-L6-v2` | Ollama / HuggingFace | 384 |

---

## Full Local Stack Example

```bash
# LLM
LLM_BASE_URL=http://localhost:11434/v1
LLM_API_KEY=ollama
LLM_MODEL=llama3.1

# Embeddings
EMBEDDING_BASE_URL=http://localhost:11434/v1
EMBEDDING_API_KEY=ollama
EMBEDDING_MODEL=nomic-embed-text
EMBEDDING_DIMENSIONS=768

# Reranking
RERANK_ENABLED=true
RERANK_PROVIDER=local
RERANK_MODEL=cross-encoder/ms-marco-MiniLM-L-6-v2
RERANK_TOP_N=5
```

---

## Reverting to Cloud APIs

```bash
# LLM — OpenRouter or OpenAI
LLM_BASE_URL=
LLM_API_KEY=your-openrouter-or-openai-key
LLM_MODEL=gpt-4o

# Embeddings — OpenAI
EMBEDDING_BASE_URL=
EMBEDDING_API_KEY=
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536

# Reranking — Cohere
RERANK_ENABLED=true
RERANK_PROVIDER=api
RERANK_API_KEY=your-cohere-key
RERANK_MODEL=rerank-v3.5
RERANK_TOP_N=5
```

Remember to run `SELECT resize_embedding_column(1536);` and re-ingest documents if you changed embedding dimensions.
