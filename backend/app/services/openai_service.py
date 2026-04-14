from __future__ import annotations

from typing import TYPE_CHECKING

from openai import OpenAI

from app.config import settings

if TYPE_CHECKING:
    from app.models.user_settings import UserEffectiveSettings

SEARCH_DOCUMENTS_TOOL = {
    "type": "function",
    "function": {
        "name": "search_documents",
        "description": (
            "Search the user's uploaded documents for relevant information. "
            "Use metadata_filter to narrow results to specific document attributes "
            "when the user's request implies a scope (e.g. 'find all 2024 reports', "
            "'only look in Python tutorials', 'search financial documents'). "
            "Supported filter keys: document_type, language, author, date."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The semantic search query to find relevant document chunks.",
                },
                "metadata_filter": {
                    "type": "object",
                    "description": (
                        "Optional JSONB containment filter applied to document metadata. "
                        "Each key-value pair must match the stored metadata exactly. "
                        "Example: {\"document_type\": \"report\"} or {\"language\": \"French\"}. "
                        "Omit this parameter when no document-level scoping is needed."
                    ),
                    "additionalProperties": {"type": "string"},
                },
            },
            "required": ["query"],
        },
    },
}


QUERY_DOCUMENTS_TOOL = {
    "type": "function",
    "function": {
        "name": "query_documents",
        "description": (
            "Run a SQL SELECT query against the user's documents or folders tables to answer "
            "structured questions about their uploaded files and folder organisation. Use for "
            "questions like 'how many documents do I have?', 'list all PDFs', 'which files were "
            "uploaded in 2024?', 'what folders do I have?', 'which folder is X in?'. "
            "Table: documents. Columns: id (uuid), filename (text), file_type (text), "
            "status (text, e.g. 'completed'), created_at (timestamptz), folder_id (uuid, nullable, "
            "references folders.id), "
            "metadata (jsonb with keys: title, author, date, document_type, topics, "
            "language, summary). "
            "Table: folders. Columns: id (uuid), name (text), parent_id (uuid, nullable), "
            "user_id (uuid), is_global (boolean). "
            "JOIN example: SELECT d.filename, f.name AS folder FROM documents d "
            "LEFT JOIN folders f ON d.folder_id = f.id. "
            "The query is automatically scoped to the current user — do NOT add a "
            "user_id filter yourself."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "A valid SQL SELECT statement. No semicolons.",
                }
            },
            "required": ["query"],
        },
    },
}

LS_TOOL = {
    "type": "function",
    "function": {
        "name": "ls",
        "description": (
            "List the immediate contents (subfolders and documents) at a folder path in the user's "
            "knowledge base. Use for navigation questions: 'what's in my Reports folder?', "
            "'list documents in /Finance/Q1', 'show me the subfolders of Research', "
            "'what folders do I have at the root?'. Use path='/' for root. "
            "Prefer ls over query_documents for folder browsing and navigation tasks."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Folder path to list, e.g. '/', '/Reports', '/Finance/Q1'.",
                }
            },
            "required": ["path"],
        },
    },
}

TREE_TOOL = {
    "type": "function",
    "function": {
        "name": "tree",
        "description": (
            "Show the full folder hierarchy of the user's knowledge base as a tree, with documents "
            "attached to each folder. Use when the user wants a structural overview: 'show me my "
            "folder structure', 'what's the hierarchy?', 'show everything in Research as a tree'. "
            "Use depth to limit expansion (e.g. depth=2 for two levels). Omit depth for the full tree."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Root path for the tree, e.g. '/' or '/Reports'.",
                },
                "depth": {
                    "type": "integer",
                    "description": "Max depth to expand (1 = immediate children only). Omit for full tree.",
                },
            },
            "required": ["path"],
        },
    },
}

GREP_TOOL = {
    "type": "function",
    "function": {
        "name": "grep",
        "description": (
            "Search the content of the user's documents using a regex pattern. Returns document names "
            "where the extracted markdown content matches. Use for finding specific text, code snippets, "
            "or patterns inside documents: 'find documents mentioning budget', 'which files contain Python code?', "
            "'find all references to API keys'. Optionally scope to a folder path."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "pattern": {
                    "type": "string",
                    "description": "Regex pattern to search for in document content (Postgres ~ operator).",
                },
                "path": {
                    "type": "string",
                    "description": "Optional folder path to scope search, e.g. '/reports'. Omit to search all documents.",
                },
            },
            "required": ["pattern"],
        },
    },
}

GLOB_TOOL = {
    "type": "function",
    "function": {
        "name": "glob",
        "description": (
            "Find documents by filename pattern using glob syntax. Use for locating files by name "
            "or extension: 'find all PDFs', 'find files named report*', 'find all .docx files in reports'. "
            "Supports * (any chars), ? (single char), ** (recursive directory match). "
            "Examples: '*.pdf', 'reports/**/*.pdf', 'meeting-notes-*'."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "pattern": {
                    "type": "string",
                    "description": "Glob pattern for filename matching, e.g. '*.pdf', 'reports/**/*.pdf'.",
                },
            },
            "required": ["pattern"],
        },
    },
}

READ_DOCUMENT_TOOL = {
    "type": "function",
    "function": {
        "name": "read_document",
        "description": (
            "Read the raw markdown content of a document by its ID. "
            "Use after grep or glob to inspect the full content or a specific section. "
            "Provide start_line and end_line to read a specific range (1-based, inclusive). "
            "Omit both to read the full document. "
            "Line-range results include line numbers so you can orient further reads."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "document_id": {
                    "type": "string",
                    "description": "UUID of the document to read.",
                },
                "start_line": {
                    "type": "integer",
                    "description": "First line to return (1-based, inclusive). Omit for full document.",
                },
                "end_line": {
                    "type": "integer",
                    "description": "Last line to return (1-based, inclusive). Omit for full document.",
                },
            },
            "required": ["document_id"],
        },
    },
}


WEB_SEARCH_TOOL = {
    "type": "function",
    "function": {
        "name": "web_search",
        "description": (
            "Search the web for current information not available in the user's "
            "uploaded documents. Use when the user asks about recent events, "
            "general knowledge, or topics clearly outside their document library. "
            "Always prefer search_documents first if the answer may be in their files. "
            "Always cite sources (title + URL) in your response."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The web search query.",
                }
            },
            "required": ["query"],
        },
    },
}


ANALYZE_DOCUMENT_TOOL = {
    "type": "function",
    "function": {
        "name": "analyze_document",
        "description": (
            "Perform deep analysis of a specific document by reading its FULL content. "
            "Use for summarization, comparison, critique, extracting key points — tasks "
            "requiring the entire document, not just chunks. Provide the document filename "
            "as it appears in the user's library."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "filename": {
                    "type": "string",
                    "description": "The filename of the document to analyze. Partial or approximate names are accepted (e.g. 'Elitefooty PRD' will match 'PRD Update_ EliteFooty App Architecture.docx').",
                },
                "task": {
                    "type": "string",
                    "description": "What the user wants done with the document (e.g., 'summarize', 'critique arguments', 'extract key points').",
                },
            },
            "required": ["filename", "task"],
        },
    },
}


LOAD_SKILL_TOOL = {
    "type": "function",
    "function": {
        "name": "load_skill",
        "description": (
            "Load the full instructions and attached file list for a skill by name. "
            "Use when the user's request matches a skill in the catalog. "
            "After loading, follow the skill instructions to fulfil the request."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "skill_name": {
                    "type": "string",
                    "description": "The exact name of the skill to load, as shown in the catalog.",
                }
            },
            "required": ["skill_name"],
        },
    },
}

SAVE_SKILL_TOOL = {
    "type": "function",
    "function": {
        "name": "save_skill",
        "description": (
            "Create or update a skill with the given name, description, and instructions. "
            "Use when the user wants to save a new skill or update an existing one."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Skill name (unique per user)."},
                "description": {"type": "string", "description": "One-sentence summary shown in the catalog."},
                "instructions": {"type": "string", "description": "Full markdown instructions for the skill."},
            },
            "required": ["name", "description", "instructions"],
        },
    },
}

READ_SKILL_FILE_TOOL = {
    "type": "function",
    "function": {
        "name": "read_skill_file",
        "description": (
            "Read the content of a file attached to a skill. "
            "Use after load_skill returns a file list to inspect building-block files."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "skill_name": {"type": "string", "description": "Name of the skill that owns the file."},
                "filename": {"type": "string", "description": "Exact filename as returned by load_skill."},
            },
            "required": ["skill_name", "filename"],
        },
    },
}

EXECUTE_CODE_TOOL = {
    "type": "function",
    "function": {
        "name": "execute_code",
        "description": (
            "Execute Python code in a sandboxed Docker container. "
            "IMPORTANT: The sandbox has only the Python standard library pre-installed. "
            "You MUST pass the `libraries` parameter for every third-party package your code uses "
            "(e.g. matplotlib, numpy, pandas, seaborn, scipy, python-docx, openpyxl, pillow, requests). "
            "Variables and installed packages persist across calls within the same conversation thread. "
            "Write output files to /sandbox/output/ and they will be returned as download links. "
            "Use skill_files to inject skill attachment files (templates, assets) into the sandbox "
            "at /sandbox/{filename} before your code runs — reference them with that path in code. "
            "Use this for data analysis, calculations, generating charts, creating documents, "
            "or any task that benefits from running actual Python code."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "description": {
                    "type": "string",
                    "description": "Short human-readable label for what this code does (e.g. 'Generating PowerPoint presentation', 'Creating PDF report', 'Plotting sales chart'). Shown to the user while the code runs.",
                },
                "code": {
                    "type": "string",
                    "description": "Python code to execute.",
                },
                "libraries": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Optional list of PyPI packages to install before execution (e.g. ['pandas', 'matplotlib']).",
                },
                "output_files": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Optional list of expected output filenames in /sandbox/output/ to return as download links.",
                },
                "skill_files": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "skill_name": {"type": "string", "description": "Name of the skill that owns the file."},
                            "filename": {"type": "string", "description": "Exact filename as returned by load_skill."},
                        },
                        "required": ["skill_name", "filename"],
                    },
                    "description": "Optional list of skill attachment files to inject into the sandbox before execution. Each file is written to /sandbox/{filename} and can be opened in code using that path (e.g. open('/sandbox/template.docx', 'rb')).",
                },
            },
            "required": ["code"],
        },
    },
}


EXPLORER_SYSTEM_PROMPT = (
    "You are a Knowledge Base Explorer. Navigate the user's document library using the fewest tool calls needed.\n\n"
    "## CRITICAL: Stop when you have the answer\n"
    "After each tool call, check: can I answer now? If yes — stop and respond. "
    "Do not call more tools to verify an answer you already have.\n\n"
    "Tools:\n"
    "- ls — list files and subfolders at a path\n"
    "- tree — view hierarchical folder structure\n"
    "- grep — search document contents by regex pattern; returns matching filenames + snippets\n"
    "- glob — find documents by filename pattern\n"
    "- read_document — read a document section by document_id; use start_line/end_line; do NOT call more than once per document\n"
    "- analyze_document — deep analysis of a full document (summarize, compare, extract all key points)\n\n"
    "Rules:\n"
    "- Most tasks need 1-3 tool calls. Use grep or glob first to locate the document, then read_document for a targeted section.\n"
    "- If grep returns matching snippets that answer the question, respond from those — no need to read_document.\n"
    "- If a read_document line range returns nothing or is out of bounds, fall back to analyze_document on that document "
    "rather than answering from nothing — unless analyze_document was already called this turn.\n"
    "- Never call the same tool twice with the same arguments.\n"
    "- Always cite which document(s) your answer comes from.\n"
    "- Return a coherent prose answer — never raw JSON or raw tool output."
)


def get_tools() -> list[dict]:
    """Return the active tool list based on current config."""
    tools = [SEARCH_DOCUMENTS_TOOL, QUERY_DOCUMENTS_TOOL, LS_TOOL, TREE_TOOL, GREP_TOOL, GLOB_TOOL, READ_DOCUMENT_TOOL, ANALYZE_DOCUMENT_TOOL,
             LOAD_SKILL_TOOL, SAVE_SKILL_TOOL, READ_SKILL_FILE_TOOL]
    if settings.web_search_enabled:
        tools.append(WEB_SEARCH_TOOL)
    if settings.sandbox_enabled:
        tools.append(EXECUTE_CODE_TOOL)
    return tools


def get_explorer_tools() -> list[dict]:
    """Tool list for explorer mode: KB navigation + document analysis only."""
    return [LS_TOOL, TREE_TOOL, GREP_TOOL, GLOB_TOOL, READ_DOCUMENT_TOOL, ANALYZE_DOCUMENT_TOOL]


def get_llm_client(user_settings: UserEffectiveSettings | None = None) -> OpenAI:
    if user_settings is not None:
        kwargs: dict = {"api_key": user_settings.llm_api_key}
        if user_settings.llm_base_url:
            kwargs["base_url"] = user_settings.llm_base_url
    else:
        kwargs = {"api_key": settings.llm_api_key}
        if settings.llm_base_url:
            kwargs["base_url"] = settings.llm_base_url
    client = OpenAI(**kwargs)
    # Auto-trace all LLM calls (inputs, system prompt, tools, outputs) via LangSmith
    # when a LangSmith API key is configured. Best-effort — never blocks startup.
    if settings.langsmith_api_key:
        try:
            from langsmith.wrappers import wrap_openai
            client = wrap_openai(client)  # type: ignore[assignment]
        except Exception:
            pass
    return client


def get_embedding_client(user_settings: UserEffectiveSettings | None = None) -> OpenAI:
    if user_settings is not None:
        if user_settings.embedding_api_key:
            # Dedicated embedding key — use its own base_url only, never inherit LLM base_url
            api_key = user_settings.embedding_api_key
            base_url = user_settings.embedding_base_url or None
        else:
            # No dedicated key — reuse LLM credentials (key + base_url)
            api_key = user_settings.llm_api_key
            base_url = user_settings.embedding_base_url or user_settings.llm_base_url or None
    else:
        if settings.embedding_api_key:
            # Dedicated embedding key — use its own base_url only, never inherit LLM base_url
            api_key = settings.embedding_api_key
            base_url = settings.embedding_base_url or None
        else:
            # No dedicated key — reuse LLM credentials (key + base_url)
            api_key = settings.llm_api_key
            base_url = settings.embedding_base_url or settings.llm_base_url or None

    kwargs: dict = {"api_key": api_key}
    if base_url:
        kwargs["base_url"] = base_url
    return OpenAI(**kwargs)


# Per-provider safe max output token defaults (fallback when no model entry exists).
#
# Anthropic's compat layer silently defaults to 1024 tokens if max_tokens is
# unset — always override it. Other providers are lenient but explicit is better.
#
# Values chosen as practical ceilings for RAG chat responses. Users needing
# longer outputs (e.g. full-document rewrites) can override via MODEL_OUTPUT_LIMITS
# or LLM_MAX_OUTPUT_TOKENS in .env.
_PROVIDER_DEFAULT_MAX_TOKENS: dict[str, int] = {
    "anthropic":  16384,  # Sonnet/Opus support 32k-64k; 16k covers code gen without runaway
    "google":     16384,  # Gemini 2.5 can do 65k; 16k is plenty and avoids runaway outputs
    "openai":     16384,  # GPT-4o / GPT-4.1 support 16k+ safely
    "openrouter": 16384,  # passes through; most hosted models support 16k
    "ollama":     4096,   # local hardware varies; keep conservative
}
_FALLBACK_MAX_TOKENS = 8192  # used when provider is unknown / legacy mode

# Per-model output token defaults. Tuned to each model's real ceiling vs practical need.
# Override any entry via MODEL_OUTPUT_LIMITS in .env (format: model-id=tokens,...)
_MODEL_OUTPUT_DEFAULTS: dict[str, int] = {
    # ── OpenAI ──────────────────────────────────────────────────────────────
    "gpt-4o":                                16384,  # supports 16k
    "gpt-4o-mini":                           16384,  # supports 16k
    "gpt-4.1":                               32768,  # supports 32k
    "gpt-4.1-mini":                          32768,  # supports 32k
    "gpt-4.1-nano":                          16384,  # nano — keep conservative
    # ── Anthropic ───────────────────────────────────────────────────────────
    "claude-haiku-4-5-20251001":              8192,  # hard ceiling 8k
    "claude-sonnet-4-6":                     32768,  # supports 64k; 32k practical
    "claude-opus-4-6":                       16384,  # supports 32k; 16k conservative
    # ── Google ──────────────────────────────────────────────────────────────
    "gemini-2.5-pro":                        32768,  # supports 65k; 32k practical
    "gemini-2.5-flash":                      32768,  # supports 65k; 32k practical
    "gemini-2.5-flash-lite":                 16384,  # lite — keep conservative
    # ── OpenRouter ──────────────────────────────────────────────────────────
    "meta-llama/llama-3.3-70b-instruct":     16384,  # standard
    "deepseek/deepseek-r1":                  16384,  # standard via OpenRouter
    "moonshotai/kimi-k2.5":                  65536,  # supports 65.5k output; use full ceiling
    "minimax/minimax-m2.7":                  65536,  # supports 131k output; 64k practical
    "minimax/minimax-m2.5:free":             16384,  # free tier — conservative
    "nvidia/nemotron-3-super-120b-a12b:free": 16384,  # free tier — conservative
    "google/gemma-4-26b-a4b-it":             32768,  # supports 262k output; 32k practical
    "google/gemma-4-31b-it:free":            32768,  # supports 32.8k output
}


def _parse_model_output_limits(raw: str) -> dict[str, int]:
    """Parse 'model-id=tokens,model-id=tokens' into a dict.

    Uses = as separator to avoid ambiguity with model IDs containing colons.
    """
    result: dict[str, int] = {}
    for entry in raw.split(","):
        entry = entry.strip()
        if "=" not in entry:
            continue
        model, _, raw_tokens = entry.partition("=")
        model = model.strip()
        try:
            result[model] = int(raw_tokens.strip())
        except ValueError:
            pass
    return result


def _resolve_max_tokens(
    explicit: int | None,
    user_settings: "UserEffectiveSettings | None",
) -> int:
    """Pick the right max_tokens for this call.

    Priority:
    1. Caller-supplied explicit value (rare — used by sub-agents etc.)
    2. LLM_MAX_OUTPUT_TOKENS env var, IF the user changed it from the package default.
    3. MODEL_OUTPUT_LIMITS env var — per-model override.
    4. _MODEL_OUTPUT_DEFAULTS — hardcoded per-model practical limits.
    5. _PROVIDER_DEFAULT_MAX_TOKENS — per-provider fallback.
    6. _FALLBACK_MAX_TOKENS for unknown/legacy providers.
    """
    if explicit is not None:
        return explicit

    env_val = settings.llm_max_output_tokens
    env_default = 8192  # matches the default in config.py
    if env_val != env_default:
        # User deliberately set LLM_MAX_OUTPUT_TOKENS — respect it for all providers
        return env_val

    model = (user_settings.llm_model if user_settings else "") or settings.llm_model or ""
    if model:
        env_overrides = _parse_model_output_limits(settings.model_output_limits)
        if model in env_overrides:
            return env_overrides[model]
        if model in _MODEL_OUTPUT_DEFAULTS:
            return _MODEL_OUTPUT_DEFAULTS[model]

    provider = (user_settings.active_provider if user_settings else "") or settings.llm_provider or ""
    return _PROVIDER_DEFAULT_MAX_TOKENS.get(provider.lower(), _FALLBACK_MAX_TOKENS)


def _uses_max_completion_tokens(model: str) -> bool:
    """Return True for models that require max_completion_tokens instead of max_tokens.

    OpenAI o-series and GPT-5+ family dropped max_tokens in favour of
    max_completion_tokens. Sending max_tokens to these models returns a 400.
    """
    m = model.lower()
    # o1 / o3 / o4 reasoning models
    if m.startswith(("o1", "o3", "o4")):
        return True
    # GPT-5 family: gpt-5, gpt-5.1, gpt-5.2, gpt-5.4, gpt-5.4-mini, etc.
    if m.startswith("gpt-5"):
        return True
    return False


def create_streaming_chat(
    messages: list[dict],
    tool_choice: str = "auto",
    model: str | None = None,
    user_settings: UserEffectiveSettings | None = None,
    tools_override: list[dict] | None = None,
    max_tokens: int | None = None,
):
    client = get_llm_client(user_settings)
    effective_model = model or (user_settings.llm_model if user_settings else None) or settings.llm_model
    resolved_tokens = _resolve_max_tokens(max_tokens, user_settings)
    # GPT-5 / o-series use max_completion_tokens; everything else uses max_tokens.
    # Anthropic compat defaults to 1024 if unset — always be explicit.
    token_param = "max_completion_tokens" if _uses_max_completion_tokens(effective_model) else "max_tokens"
    kwargs: dict = {
        "model": effective_model,
        "messages": messages,
        "stream": True,
        token_param: resolved_tokens,
    }
    if tool_choice == "auto":
        kwargs["tools"] = tools_override if tools_override is not None else get_tools()
        kwargs["tool_choice"] = "auto"
    return client.chat.completions.create(**kwargs)


def embed_texts(
    texts: list[str],
    model: str | None = None,
    user_settings: UserEffectiveSettings | None = None,
) -> list[list[float]]:
    client = get_embedding_client(user_settings)
    effective_model = model or (user_settings.embedding_model if user_settings else None) or settings.embedding_model
    response = client.embeddings.create(
        model=effective_model,
        input=texts,
    )
    return [item.embedding for item in response.data]
