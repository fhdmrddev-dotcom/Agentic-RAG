from __future__ import annotations

from typing import TYPE_CHECKING

from langsmith import traceable
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


def get_tools() -> list[dict]:
    """Return the active tool list based on current config."""
    tools = [SEARCH_DOCUMENTS_TOOL, QUERY_DOCUMENTS_TOOL, LS_TOOL, TREE_TOOL, GREP_TOOL, GLOB_TOOL, READ_DOCUMENT_TOOL, ANALYZE_DOCUMENT_TOOL]
    if settings.web_search_enabled:
        tools.append(WEB_SEARCH_TOOL)
    return tools


def get_llm_client(user_settings: UserEffectiveSettings | None = None) -> OpenAI:
    if user_settings is not None:
        kwargs: dict = {"api_key": user_settings.llm_api_key}
        if user_settings.llm_base_url:
            kwargs["base_url"] = user_settings.llm_base_url
    else:
        kwargs = {"api_key": settings.llm_api_key}
        if settings.llm_base_url:
            kwargs["base_url"] = settings.llm_base_url
    return OpenAI(**kwargs)


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


@traceable(name="chat-completions", run_type="llm")
def create_streaming_chat(
    messages: list[dict],
    tool_choice: str = "auto",
    model: str | None = None,
    user_settings: UserEffectiveSettings | None = None,
):
    client = get_llm_client(user_settings)
    effective_model = model or (user_settings.llm_model if user_settings else None) or settings.llm_model
    kwargs: dict = {
        "model": effective_model,
        "messages": messages,
        "stream": True,
    }
    if tool_choice == "auto":
        kwargs["tools"] = get_tools()
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
