from __future__ import annotations

import logging
from enum import Enum
from typing import TYPE_CHECKING

from openai import OpenAI

from app.config import settings, get_model_capability, MODEL_CAPABILITIES

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from app.models.user_settings import UserEffectiveSettings

SEARCH_DOCUMENTS_TOOL = {
    "type": "function",
    "function": {
        "name": "search_documents",
        "description": (
            "Search the user's uploaded documents for relevant information. "
            "Returns matching chunks with similarity scores. "
            "IMPORTANT: call this WITHOUT metadata_filter first. Only add "
            "metadata_filter when the user explicitly names a document attribute "
            "to filter on (e.g. 'only search French documents'). Do NOT guess "
            "filter values like 'paper', 'thesis', or 'survey' — these will "
            "silently return zero results if the metadata doesn't match exactly. "
            "Supported filter keys (when needed): document_type, language, author, date."
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
                        "Optional JSONB containment filter on document metadata. "
                        "Each key-value pair must match stored metadata EXACTLY "
                        "(case-insensitive). OMIT this parameter unless the user "
                        "explicitly asks to scope by a metadata attribute. "
                        "Wrong values silently return zero results."
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
            "Table: documents. Columns: id (uuid), filename (text), mime_type (text, "
            "e.g. 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', "
            "'text/plain'), status (text, e.g. 'completed'), created_at (timestamptz), "
            "folder_id (uuid, nullable, references folders.id), "
            "metadata (jsonb with keys: title, author, date, document_type, topics, "
            "language, summary). "
            "IMPORTANT: the file-type column is named mime_type, NOT file_type. "
            "To filter PDFs use: WHERE d.mime_type = 'application/pdf'. "
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

REMEMBER_TOOL = {
    "type": "function",
    "function": {
        "name": "remember",
        "description": (
            "Store a fact or preference about the user that should persist across conversations. "
            "Use when the user states a preference (e.g. 'I prefer bullet points'), "
            "shares a personal fact (e.g. 'I work in finance'), or explicitly asks you to remember something. "
            "Key should be a short snake_case label (e.g. 'response_format', 'industry', 'name'). "
            "Calling remember with an existing key overwrites the previous value — keys are case-insensitive."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "key": {
                    "type": "string",
                    "description": "Short snake_case label for the fact (e.g. 'response_format', 'name', 'industry').",
                },
                "value": {
                    "type": "string",
                    "description": "The fact or preference to store, in the user's own words.",
                },
            },
            "required": ["key", "value"],
        },
    },
}

RECALL_TOOL = {
    "type": "function",
    "function": {
        "name": "recall",
        "description": (
            "Retrieve stored memory entries about the user. "
            "Call with no arguments to list all stored facts and preferences. "
            "Call with a specific key to retrieve the value for that key. "
            "If the key is not found, returns a 'No memory entry found' message."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "key": {
                    "type": "string",
                    "description": "The key to look up. Omit to retrieve all stored entries.",
                },
            },
            "required": [],
        },
    },
}

QUERY_TABLES_TOOL = {
    "type": "function",
    "function": {
        "name": "query_tables",
        "description": (
            "Query structured tables extracted from a specific document. "
            "Use when the user asks for data from a document's tables: "
            "'show me all rows in the revenue table', "
            "'what are the column headers in the financial summary?', "
            "'find rows where Region is APAC in Q3 Report'. "
            "Returns table headers and matching rows (up to 50 rows per table). "
            "Use column_filter to filter rows where a specific column matches a value."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "document_name": {
                    "type": "string",
                    "description": "Filename (or partial name) of the document to query.",
                },
                "column_filter": {
                    "type": "object",
                    "description": (
                        "Optional row filter: {\"ColumnName\": \"value\"}. "
                        "Returns only rows where that column matches exactly. "
                        "Example: {\"Region\": \"APAC\"}"
                    ),
                    "additionalProperties": {"type": "string"},
                },
                "page": {
                    "type": "integer",
                    "description": "Optional: restrict to tables on this page number only.",
                },
            },
            "required": ["document_name"],
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


def get_tools(user_settings: "UserEffectiveSettings | None" = None) -> list[dict]:
    """Return the active tool list based on per-user effective settings."""
    effective = user_settings if user_settings is not None else None
    tools = [SEARCH_DOCUMENTS_TOOL, QUERY_DOCUMENTS_TOOL, LS_TOOL, TREE_TOOL, GREP_TOOL, GLOB_TOOL, READ_DOCUMENT_TOOL, ANALYZE_DOCUMENT_TOOL,
             LOAD_SKILL_TOOL, SAVE_SKILL_TOOL, READ_SKILL_FILE_TOOL,
             REMEMBER_TOOL, RECALL_TOOL, QUERY_TABLES_TOOL]
    web_enabled = effective.web_search_enabled if effective is not None else settings.web_search_enabled
    sandbox_enabled = effective.sandbox_enabled if effective is not None else settings.sandbox_enabled
    if web_enabled:
        tools.append(WEB_SEARCH_TOOL)
    if sandbox_enabled:
        tools.append(EXECUTE_CODE_TOOL)
    return tools


def get_explorer_tools() -> list[dict]:
    """Tool list for explorer mode: KB navigation + document analysis only."""
    return [LS_TOOL, TREE_TOOL, GREP_TOOL, GLOB_TOOL, READ_DOCUMENT_TOOL, ANALYZE_DOCUMENT_TOOL]


def get_llm_client(user_settings: UserEffectiveSettings | None = None) -> OpenAI:
    # Phase 075.1 Plan 04 (B-260519-04 second half) — capture provider context
    # so the LangSmith wrap can distinguish OpenRouter / Ollama (both routed
    # via the OpenAI-compatible API) from native OpenAI traces.
    if user_settings is not None:
        kwargs: dict = {"api_key": user_settings.llm_api_key}
        if user_settings.llm_base_url:
            kwargs["base_url"] = user_settings.llm_base_url
        provider = user_settings.active_provider or "openai"
    else:
        kwargs = {"api_key": settings.llm_api_key}
        if settings.llm_base_url:
            kwargs["base_url"] = settings.llm_base_url
        provider = "openai"
    client = OpenAI(**kwargs)
    # Auto-trace all LLM calls (inputs, system prompt, tools, outputs) via LangSmith
    # when a LangSmith API key is configured. Best-effort — never blocks startup.
    if settings.langsmith_api_key:
        try:
            from langsmith.wrappers import wrap_openai
            # Phase 075.1 Plan 04 (B-260519-04) — pass per-provider chat_name so
            # OpenRouter/Ollama traces show up as ChatOpenrouter/ChatOllama in
            # LangSmith, not the hardcoded "ChatOpenAI" label. The installed
            # langsmith wrap_openai signature is
            # `(client, *, tracing_extra=None, chat_name="ChatOpenAI",
            #   completions_name="OpenAI")` — verified at plan-time.
            client = wrap_openai(client, chat_name=f"Chat{provider.title()}")  # type: ignore[assignment]
        except TypeError:
            # Older langsmith without chat_name kwarg — fall back to the
            # generic ChatOpenAI label. Provider context still flows via the
            # parent agent-loop trace name; this is a graceful degradation.
            try:
                from langsmith.wrappers import wrap_openai
                client = wrap_openai(client)  # type: ignore[assignment]
            except Exception:
                pass
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
# Per-provider practical ceilings. Revised 2026-05-24: bumped from 16k to 32k
# across all cloud providers — the app generates code (python-pptx, docx) and
# analyzes large documents, so 16k caused frequent truncation. Users needing
# tighter limits can override via MODEL_OUTPUT_LIMITS or LLM_MAX_OUTPUT_TOKENS.
_PROVIDER_DEFAULT_MAX_TOKENS: dict[str, int] = {
    "anthropic":  32768,  # Sonnet/Opus support 64k-128k; 32k handles code gen + long analysis
    "google":     32768,  # Gemini supports 65k; 32k handles code gen without truncation
    "openai":     32768,  # GPT-5.x supports 128k; 32k is safe practical ceiling
    "openrouter": 32768,  # passes through; most hosted models support 32k+
    "ollama":     8192,   # local hardware varies; keep modest
}
_FALLBACK_MAX_TOKENS = 16384  # used when provider is unknown / legacy mode

# Native providers use model-registry values — user slider overrides are ignored.
# Prevents stale OpenRouter overrides from silently capping Anthropic/OpenAI/Google.
NATIVE_PROVIDERS = frozenset({"openai", "anthropic", "google"})

# Per-model output token defaults. Tuned to each model's real ceiling vs practical need.
# Override any entry via MODEL_OUTPUT_LIMITS in .env (format: model-id=tokens,...)
_MODEL_OUTPUT_DEFAULTS: dict[str, int] = {
    # ── OpenAI ──────────────────────────────────────────────────────────────
    "gpt-4o":                                16384,  # supports 16k
    "gpt-4o-mini":                           16384,  # supports 16k — deprecated
    "gpt-4.1":                               32768,  # supports 32k — deprecated
    "gpt-4.1-mini":                          32768,  # supports 32k — deprecated
    "gpt-4.1-nano":                          16384,  # nano — deprecated
    "gpt-5":                                 32768,  # superseded by 5.4+
    "gpt-5.4":                               65536,  # supports 128k; 64K practical ceiling
    "gpt-5.4-mini":                          32768,  # supports 128k; 32K conservative
    "gpt-5.4-nano":                          16384,  # budget — keep conservative
    "gpt-5.5":                               65536,  # supports 128k; 64K practical ceiling
    # ── Anthropic ───────────────────────────────────────────────────────────
    "claude-opus-4-7":                       32768,  # supports 128k; 32k practical for agentic RAG
    "claude-haiku-4-5-20251001":             32768,  # supports 64k; 32k practical for sub-agent analysis
    "claude-sonnet-4-5":                     32768,  # supports 64k; 32k practical
    "claude-sonnet-4-6":                     32768,  # supports 64k; 32k practical
    "claude-opus-4-6":                       32768,  # supports 128k; 32k practical
    # ── Google ──────────────────────────────────────────────────────────────
    "gemini-3.1-pro-preview":                32768,  # preview — conservative ceiling
    "gemini-2.5-pro":                        32768,  # supports 65k; 32k practical
    "gemini-2.5-flash":                      32768,  # supports 65k; 32k practical
    "gemini-2.5-flash-lite":                 32768,  # supports 65k; 32k practical
    "gemini-3-flash-preview":                32768,  # preview — conservative ceiling
    "gemini-3.5-flash":                      32768,  # mirrors 2.5-flash ceiling
    "gemini-3.1-flash-lite":                 32768,  # mirrors 2.5-flash-lite ceiling
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

    Phase 074 D-074-01: After resolution, ALL priority branches flow through
    a single clamp gate at the bottom of this function. The clamp returns
    ``min(resolved, MODEL_CAPABILITIES[model]["max_output_tokens"])`` when an
    entry exists and ``resolved`` exceeds it; pass-through otherwise per
    D-074-02. The function was refactored from a 6-early-return shape to
    single-return to ensure the clamp covers every priority branch
    (RESEARCH.md Pitfall 1).
    """
    if explicit is not None:
        resolved = explicit
    else:
        provider = (user_settings.active_provider if user_settings else "") or settings.llm_provider or ""

        # For native providers: skip user override to prevent stale slider values
        # from silently capping output. (GEN-05 defense-in-depth)
        resolved_from_priority: int | None = None
        if provider.lower() not in NATIVE_PROVIDERS:
            user_max_tokens = getattr(user_settings, "llm_max_output_tokens", 0) if user_settings else 0
            if user_max_tokens > 0:
                resolved_from_priority = user_max_tokens

        if resolved_from_priority is None:
            env_val = settings.llm_max_output_tokens
            env_default = 8192  # matches the default in config.py
            if env_val != env_default:
                # User deliberately set LLM_MAX_OUTPUT_TOKENS in .env — respect it for all providers
                resolved_from_priority = env_val

        if resolved_from_priority is None:
            model = (user_settings.llm_model if user_settings else "") or settings.llm_model or ""
            if model:
                env_overrides = _parse_model_output_limits(settings.model_output_limits)
                if model in env_overrides:
                    resolved_from_priority = env_overrides[model]
                elif model in _MODEL_OUTPUT_DEFAULTS:
                    resolved_from_priority = _MODEL_OUTPUT_DEFAULTS[model]

        if resolved_from_priority is None:
            resolved_from_priority = _PROVIDER_DEFAULT_MAX_TOKENS.get(provider.lower(), _FALLBACK_MAX_TOKENS)

        resolved = resolved_from_priority

    # Phase 074 D-074-01: Clamp gate. Single chokepoint covers all priority
    # branches above (explicit value, env override, per-model default, etc.).
    # Pass-through if registry entry missing OR max_output_tokens key absent
    # per D-074-02. RESEARCH.md Open Question 2: strip ONLY the OpenRouter
    # `:exacto` quality-routing suffix (openai_service.py:838-840) before lookup.
    # Do NOT use a generic `split(":")[0]` — that would also strip legitimate
    # suffixes like `:free` on `minimax/minimax-m2.5:free`, which is a real
    # upstream model card with its own registry entry (cap=16384), and the
    # stripped form `minimax/minimax-m2.5` is NOT in the registry, so the clamp
    # would silently lose protection for the `:free` tier. Targeted
    # `.removesuffix(":exacto")` keeps both paths working.
    model_id = (user_settings.llm_model if user_settings else "") or settings.llm_model or ""
    if model_id:
        lookup_key = model_id.removesuffix(":exacto") if model_id.endswith(":exacto") else model_id
        cap = MODEL_CAPABILITIES.get(lookup_key, {}).get("max_output_tokens")
        if cap and resolved > cap:
            logger.info(
                "clamped max_tokens for model=%s: %d -> %d",
                lookup_key, resolved, cap,
            )
            return cap
    return resolved


def _uses_max_completion_tokens(model: str) -> bool:
    """Return True for models that require max_completion_tokens instead of max_tokens.

    OpenAI o-series and GPT-5+ family dropped max_tokens in favour of
    max_completion_tokens. Sending max_tokens to these models returns a 400.

    Plan 075.4-02 D-075.4-NN: registry-first. ``ModelCapability.uses_max_completion_tokens``
    populated on every o1/o3/o4/gpt-5+ row in config.MODEL_CAPABILITIES. Unregistered
    models fall back to the startswith heuristic as defense-in-depth so adding a
    new model like ``gpt-5.5-future`` works without touching this file (or until
    the new model lands in MODEL_CAPABILITIES with an explicit flag).
    """
    cap = get_model_capability(model)
    if cap.get("uses_max_completion_tokens") is not None:
        return bool(cap["uses_max_completion_tokens"])
    # Inferred fallback — keep startswith logic as defense-in-depth.
    m = (model or "").lower()
    return m.startswith(("o1", "o3", "o4")) or m.startswith("gpt-5")


# ── Provider normalization ────────────────────────────────────────────────────
#
# Each provider's OpenAI-compat layer translates its native values differently.
# Centralising the mapping here means threads.py never needs per-provider logic.

_FINISH_REASON_MAP: dict[str, str] = {
    # Anthropic compat layer
    "end_turn":       "stop",        # normal stop AND tool-call stop both arrive as end_turn
    "tool_use":       "tool_calls",  # Anthropic native tool_use (may appear in some compat versions)
    # Google compat layer
    "STOP":           "stop",
    "MAX_TOKENS":     "length",
    "SAFETY":         "stop",
    "RECITATION":     "stop",
    "OTHER":          "stop",
    # OpenAI / OpenRouter (already canonical, listed for documentation)
    "stop":           "stop",
    "tool_calls":     "tool_calls",
    "length":         "length",
    "content_filter": "stop",
}

# Providers whose compat layers reject or silently mishandle parallel_tool_calls.
# Always single-call for these; do not send the parameter at all.
_NO_PARALLEL_TOOL_CALLS: frozenset[str] = frozenset({"google"})


def normalize_finish_reason(raw: str | None) -> str | None:
    """Map any provider's finish_reason to a canonical OpenAI value.

    Unknown values pass through unchanged so new providers don't silently break.
    """
    if raw is None:
        return None
    return _FINISH_REASON_MAP.get(raw, raw)


class CallingMode(str, Enum):
    NATIVE = "native"       # Standard OpenAI tools parameter
    STRUCTURED = "structured"  # Tool schemas injected into system prompt


def resolve_calling_mode(model_id: str, user_settings: "UserEffectiveSettings | None" = None) -> CallingMode:
    """Determine whether to use native API tools or structured JSON prompting."""
    cap = get_model_capability(model_id)
    
    # OpenRouter strategy override — applies when the active provider is openrouter
    # OR when the model is explicitly in the registry as an openrouter model
    is_openrouter = (
        (user_settings is not None and user_settings.active_provider == "openrouter")
        or cap["provider"] == "openrouter"
    )
    if is_openrouter and user_settings is not None:
        strategy = getattr(user_settings, "openrouter_tool_strategy", "quality")
        if strategy == "xml":
            return CallingMode.STRUCTURED
        # quality and native both attempt native, but quality adds :exacto
        return CallingMode.NATIVE
    
    if cap["native_tools"]:
        return CallingMode.NATIVE
    return CallingMode.STRUCTURED


def create_streaming_chat(
    messages: list[dict],
    tool_choice: str = "auto",
    model: str | None = None,
    user_settings: UserEffectiveSettings | None = None,
    tools_override: list[dict] | None = None,
    max_tokens: int | None = None,
):
    """Backward-compatible wrapper — always uses native mode."""
    stream, _ = create_adaptive_streaming_chat(
        messages=messages,
        tool_choice=tool_choice,
        model=model,
        user_settings=user_settings,
        tools_override=tools_override,
        max_tokens=max_tokens,
    )
    return stream


def create_adaptive_streaming_chat(
    messages: list[dict],
    tool_choice: str = "auto",
    model: str | None = None,
    user_settings: UserEffectiveSettings | None = None,
    tools_override: list[dict] | None = None,
    max_tokens: int | None = None,
) -> tuple:
    """Returns (stream, calling_mode). calling_mode indicates how to parse the response."""
    client = get_llm_client(user_settings)
    effective_model = model or (user_settings.llm_model if user_settings else None) or settings.llm_model
    resolved_tokens = _resolve_max_tokens(max_tokens, user_settings)
    token_param = "max_completion_tokens" if _uses_max_completion_tokens(effective_model) else "max_tokens"
    
    calling_mode = resolve_calling_mode(effective_model, user_settings)
    
    effective_tokens = resolved_tokens  # GEN-01: full budget always — no reduction
    
    provider = (user_settings.active_provider if user_settings else "") or settings.llm_provider or ""

    kwargs: dict = {
        "model": effective_model,
        "messages": messages,
        "stream": True,
        token_param: effective_tokens,
    }

    # Phase 073 D-073-08 (TOKEN-COL-01) + Phase 075.3 D-075.3-05: enable
    # ``stream_options.include_usage`` on every streaming call for ALL
    # providers, including Google. The defensive chunk handler at
    # ``threads.py:_on_chunk_openai`` (Phase 075.3 D-075.3-03/04) is
    # provider-aware: Google's per-chunk cumulative ``usage`` (probe-locked
    # CUMULATIVE in 075.3-01-PLAN.md <probe_result>, 2026-05-22) is handled
    # via overwrite-last-wins inside ``_accumulate_chunk_usage``. OpenAI's
    # final-chunk-only emission (empty ``choices=[]`` + populated ``usage``)
    # still sums via ``+=``. OpenRouter is forward-compatible per Pitfall 8.
    # The quick-task 260522-gdg google-exclusion gate is reverted — Path A
    # is superseded by the defensive handler.
    kwargs["stream_options"] = {"include_usage": True}

    if tool_choice == "auto":
        if calling_mode == CallingMode.NATIVE:
            # Native mode: pass tools via API parameter
            kwargs["tools"] = tools_override if tools_override is not None else get_tools(user_settings)
            kwargs["tool_choice"] = "auto"
            # Plan 075.4-02 D-075.4-NN — registry-first parallel-tools gate.
            # Existing semantic: set ``parallel_tool_calls=False`` ONLY for providers
            # that SUPPORT the kwarg (the kwarg exists to disable parallel tools where
            # the API supports them; sending it to providers that REJECT it 400s).
            # registry ``supports_parallel_tools`` populated False on google rows.
            # Unregistered models infer support via legacy frozenset fallback so
            # adding a future ``foo-provider`` is registry-only.
            cap = get_model_capability(effective_model)
            supports_parallel = cap.get("supports_parallel_tools")
            if supports_parallel is None:
                # Inferred fallback: provider-prefix check (legacy behavior).
                supports_parallel = (
                    (cap.get("provider", "") or "").lower() not in _NO_PARALLEL_TOOL_CALLS
                )
            if supports_parallel:
                kwargs["parallel_tool_calls"] = False

            # OpenRouter quality strategy enhancements
            if user_settings and getattr(user_settings, "openrouter_tool_strategy", "quality") == "quality":
                if effective_model.startswith("openrouter/") or "/" in effective_model:
                    # Append :exacto for quality routing if not already present
                    if ":exacto" not in effective_model:
                        kwargs["model"] = f"{effective_model}:exacto"
                    # Enable Response Healing plugin
                    kwargs.setdefault("extra_body", {})
                    kwargs["extra_body"]["plugins"] = [{"id": "response-healing"}]
        else:
            # Structured mode: DO NOT pass tools param
            # Tool schemas are injected into system prompt by caller (threads.py)
            pass
    
    stream = client.chat.completions.create(**kwargs)
    return stream, calling_mode


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
