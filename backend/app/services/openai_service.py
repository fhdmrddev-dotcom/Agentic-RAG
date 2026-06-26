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
            "IMPORTANT: id is a UUID — never use LIKE or ILIKE on it. "
            "To search by a document identifier or name, check metadata->>'title' or filename. "
            "IMPORTANT: the file-type column is named mime_type, NOT file_type. "
            "To filter PDFs use: WHERE d.mime_type = 'application/pdf'. "
            "Metadata query example: SELECT d.filename, d.metadata->>'title' AS title, "
            "d.metadata->>'author' AS author FROM documents d "
            "WHERE d.metadata->>'title' ILIKE '%search_term%'. "
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

# Phase 115 (VIEW-07) — the one new agent tool: list ALL documents matching a saved
# view or exact metadata criteria (complete, deterministic, newest-first; NO semantic
# ranking, NO query string). Cross-provider-safe shape (RESEARCH §Pattern 1, D-115-13):
# two FLAT optional fields `view` XOR `filter` + optional `limit`, the either/or
# invariant stated in PROSE (never anyOf/oneOf — Gemini function-calling rejects them),
# the nested `filter` mirroring render_template's nested-object-with-required precedent
# (production-proven across the native-7), and the condition `op` enum matching
# ViewCondition.op (models/document_view.py:42-64) EXACTLY so the parsed object validates
# against ViewFilter.model_validate(...) without translation.
QUERY_DOCUMENTS_BY_VIEW_TOOL = {
    "type": "function",
    "function": {
        "name": "query_documents_by_view",  # final name — D-115-12
        "description": (
            "List ALL documents matching a saved view or exact metadata criteria — "
            "complete, deterministic, newest-first, NO semantic ranking and NO search "
            "query string. Use this for 'show me all X', 'how many X', 'list my "
            "contracts', 'open my Invoices view', 'which docs expire within 90 days'. "
            "This is NOT search_documents (which needs a natural-language query and "
            "returns ranked top-K passages) and NOT query_documents (free SQL). "
            "Provide EXACTLY ONE of: `view` (a saved view name) OR `filter` (inline "
            "metadata conditions). Provide NEITHER to discover what saved views and "
            "filterable fields exist (a catalog is returned — then call again with a "
            "concrete choice). Never provide both."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "view": {
                    "type": "string",
                    "description": (
                        "Name of a saved view to run (e.g. 'Invoices', 'Expiring "
                        "Contracts'). Case-insensitive. Omit to use `filter` or to "
                        "request the catalog."
                    ),
                },
                "filter": {
                    "type": "object",
                    "description": (
                        "An inline metadata filter (use INSTEAD of `view`). A flat "
                        "AND-list of conditions; every condition matches exactly."
                    ),
                    "properties": {
                        "op": {"type": "string", "enum": ["and"]},
                        "conditions": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "field": {
                                        "type": "string",
                                        "description": "A filterable field (call with no args to see the catalog of fields).",
                                    },
                                    "op": {
                                        "type": "string",
                                        "enum": [
                                            "eq", "gte", "lte", "one_of", "contains",
                                            "is_empty", "within_next", "older_than",
                                            "before", "after", "between",
                                        ],
                                    },
                                    "value": {"type": ["string", "number", "boolean", "null"]},
                                    "value2": {
                                        "type": ["string", "number", "null"],
                                        "description": "Upper bound for 'between'.",
                                    },
                                    "values": {
                                        "type": "array",
                                        "items": {"type": "string"},
                                        "description": "Membership list for 'one_of'.",
                                    },
                                    "unit": {
                                        "type": "string",
                                        "enum": ["days", "weeks", "months"],
                                        "description": "Span unit for within_next/older_than.",
                                    },
                                },
                                "required": ["field", "op"],
                            },
                        },
                    },
                    "required": ["op", "conditions"],
                },
                "limit": {
                    "type": "integer",
                    "description": "Max rows to return (default 20, hard cap 50). The TRUE total is always reported.",
                },
            },
            # No top-level required → catalog mode (neither field) is reachable.
        },
    },
}


# Phase 116 (REL-04) — get_related_documents: traverse the human-curated relationship
# graph (D-116-8). SIMPLER than QUERY_DOCUMENTS_BY_VIEW_TOOL by design: two flat scalar-
# string fields, NO anyOf/oneOf, NO multi-type `type` arrays. The a5b0b917 discipline —
# avoiding anyOf/oneOf is NECESSARY-NOT-SUFFICIENT for Gemini; a multi-type `type:[...]`
# array ALSO 400s google-genai (Phase 115 live UAT). The "provide exactly one" either/or
# lives in PROSE, never in the schema shape; the handler resolves whichever one is given.
GET_RELATED_DOCUMENTS_TOOL = {
    "type": "function",
    "function": {
        "name": "get_related_documents",
        "description": (
            "List the typed relationships a document has with OTHER documents — the "
            "human-curated links, NOT semantic similarity. Returns BOTH directions: "
            "OUTGOING edges (this document supersedes / amends / references / is "
            "attached_to another) AND INCOMING edges, surfaced with the inverse label "
            "(superseded_by / amended_by / referenced_by / has_attachment). Use this for "
            "'what does this document supersede', 'which documents reference this one', "
            "'show me the related / linked / attached documents', 'what amends this "
            "contract', 'is there a newer version linked here'. This is NOT "
            "search_documents (semantic) and NOT query_documents_by_view (metadata). "
            "Identify the subject document by `document_id` (preferred) OR its exact "
            "`filename`. Provide EXACTLY ONE of the two — never both. A linked document "
            "you cannot access is shown as 'linked document (no access)' so you learn a "
            "relationship exists without seeing its contents."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "document_id": {
                    "type": "string",
                    "description": (
                        "The id of the subject document whose relationships you want "
                        "(preferred — unambiguous). Omit if you only have the filename."
                    ),
                },
                "filename": {
                    "type": "string",
                    "description": (
                        "The EXACT filename of the subject document (use INSTEAD of "
                        "`document_id` when you do not have the id). Case-insensitive "
                        "exact match — not a partial/substring search."
                    ),
                },
            },
            # No top-level `required` — the either/or is prose-only (a hard XOR in the
            # schema would push a Gemini-unsafe shape). The handler returns a calm
            # 'provide exactly one' result when neither is given.
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


# ---------------------------------------------------------------------------
# Phase 101 (TMPL-02 / TMPL-03) — the render_template tool schema (101-06 WR-01)
# ---------------------------------------------------------------------------
# WR-01 root cause: the render_template HANDLER is registered + whitelist-admitted,
# but there was NO function-schema for it anywhere, so the model never SAW the tool
# and physically could not call it. apply_tool_budget can only FILTER existing
# schemas — a whitelisted NAME with no SCHEMA is a no-op. This constant is that
# missing schema.
#
# RED LINE (Deep byte-identical): this schema is DELIBERATELY NOT appended into
# get_tools(). Deep Mode calls get_tools() directly and must stay byte-unchanged.
# The harness injects RENDER_TEMPLATE_TOOL into its per-phase tools_override
# candidate list ONLY when the fill phase whitelists "render_template"
# (phase_types._render_template_candidates). So the tool is visible ONLY on a
# declaring harness fill phase; Deep + every non-declaring phase stay identical.
#
# Pitfall 4 intact: build_field_map_tool_schema([]) touches ONLY Pydantic schema
# (GenericFieldMap.model_json_schema()) — NO docxtpl/python-docx import. The heavy
# libs are imported function-locally / shipped into the sandbox driver only.
def _build_render_template_tool() -> dict:
    """Construct the render_template OpenAI function-schema.

    ``field_map``'s shape is the GenericFieldMap envelope (built from the Pydantic
    model's JSON schema, with the template-key hint in its description). The other
    args mirror exactly what ``_handle_render_template`` reads (tool_dispatcher.py):
    ``retrieved_ids`` (the spotlight ids the citation gate validates against),
    ``out_filename`` (the OOXML basename — handler-side validated/sanitized — CR-01),
    ``asset`` (optional AssetRef → trusted library path; omitted ⇒ ephemeral upload),
    ``emission_meta`` (optional truncation metadata the D-08 guard reads).
    """
    from app.services.template_render_service import build_field_map_tool_schema

    field_map_schema = build_field_map_tool_schema([])
    return {
        "type": "function",
        "function": {
            "name": "render_template",
            "description": (
                "Fill a template document (docx/pptx/xlsx) into a real, downloadable "
                "deliverable using a CITED field-map. The LLM produces DATA (the cited "
                "field-map); deterministic code produces the FILE. Put every scalar "
                "placeholder value under field_map.scalars and every list/table value "
                "under field_map.collections, and for EVERY non-null value set "
                "source_chunk_id to the <doc id> it actually came from — never invent a "
                "value or a citation (an uncited or invented value is rejected before "
                "render). Set retrieved_ids to the spotlight/source ids you were given "
                "so the citation gate can validate. Pass `asset` to fill a trusted "
                "library template; omit it to fill an ephemeral uploaded template. The "
                "produced file is integrity-checked (re-opened, residual-token scanned) "
                "before delivery — a corrupt or half-filled file is never delivered."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "field_map": field_map_schema,
                    "retrieved_ids": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": (
                            "The spotlight/source ids (<doc id=...>) that were retrieved "
                            "for this turn. The citation gate validates every value's "
                            "source_chunk_id against this set."
                        ),
                    },
                    "out_filename": {
                        "type": "string",
                        "description": (
                            "The output filename, e.g. 'risk-register.docx'. A single "
                            "basename with a .docx/.pptx/.xlsx extension — no path "
                            "separators (a bad name is sanitized to a safe default)."
                        ),
                    },
                    "asset": {
                        "type": "object",
                        "description": (
                            "Optional. A trusted library template reference. Omit to "
                            "fill an ephemeral uploaded template instead."
                        ),
                        "properties": {
                            "asset_id": {"type": "string"},
                            "filename": {"type": "string"},
                            "kind": {"type": "string", "enum": ["template", "reference"]},
                            "mime": {"type": "string"},
                        },
                        "required": ["asset_id", "filename", "kind", "mime"],
                    },
                    "emission_meta": {
                        "type": "object",
                        "description": (
                            "Optional. Truncation metadata (stop_reason / finish_reason) "
                            "so a cut-off field-map emission is rejected, not shipped."
                        ),
                    },
                },
                "required": ["field_map", "retrieved_ids", "out_filename"],
            },
        },
    }


# Built once at import (pure Pydantic schema — Pitfall 4 safe; no heavy-lib import).
RENDER_TEMPLATE_TOOL = _build_render_template_tool()


# ---------------------------------------------------------------------------
# Phase 084: Workspace tools
# ---------------------------------------------------------------------------

WORKSPACE_WRITE_TOOL = {
    "type": "function",
    "function": {
        "name": "workspace_write",
        "description": (
            "Write or update a file in the thread's persistent workspace. "
            "The workspace is a virtual filesystem that persists across conversation turns. "
            "Use for saving reports, plans, code, data exports, or any content the user "
            "might want to reference later. Files are versioned automatically -- every "
            "write creates a new version. "
            "Path must start with / and use forward slashes (e.g. /reports/weekly.md). "
            "Maximum file size: 10MB. Workspace holds up to 100 files per thread."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "File path in the workspace (e.g. /plan.md, /data/results.csv). Must start with /.",
                },
                "content": {
                    "type": "string",
                    "description": "File content to write. For text files, this is the full content.",
                },
            },
            "required": ["path", "content"],
        },
    },
}

WORKSPACE_READ_TOOL = {
    "type": "function",
    "function": {
        "name": "workspace_read",
        "description": (
            "Read a file from the thread's workspace. Returns file content (truncated "
            "for large files). Use start_line and end_line for targeted reads of large files. "
            "For binary files, returns metadata only (size, type)."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "File path to read (e.g. /plan.md).",
                },
                "start_line": {
                    "type": ["integer", "null"],
                    "description": "Optional: start reading from this line number (1-indexed).",
                },
                "end_line": {
                    "type": ["integer", "null"],
                    "description": "Optional: stop reading at this line number (inclusive).",
                },
            },
            "required": ["path", "start_line", "end_line"],
        },
    },
}

WORKSPACE_LIST_TOOL = {
    "type": "function",
    "function": {
        "name": "workspace_list",
        "description": (
            "List files in the thread's workspace, optionally filtered by path prefix. "
            "Returns file paths, sizes, MIME types, and last-modified timestamps."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "prefix": {
                    "type": ["string", "null"],
                    "description": "Optional path prefix to filter (e.g. /reports/ lists only files under /reports/). Omit or null to list all files.",
                },
            },
            "required": ["prefix"],
        },
    },
}

WORKSPACE_DELETE_TOOL = {
    "type": "function",
    "function": {
        "name": "workspace_delete",
        "description": (
            "Delete a file from the thread's workspace. This also deletes all version history. "
            "Use with caution -- deletion is permanent."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "File path to delete (e.g. /draft.md).",
                },
            },
            "required": ["path"],
        },
    },
}

WORKSPACE_DIFF_TOOL = {
    "type": "function",
    "function": {
        "name": "workspace_diff",
        "description": (
            "Show the differences between two versions of a workspace file. "
            "Returns a unified diff with additions and deletions. "
            "Use to review changes made to a file across versions."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "File path to diff (e.g. /plan.md).",
                },
                "from_version": {
                    "type": ["integer", "null"],
                    "description": "Version number to diff from (older version). Omit to use the previous version.",
                },
                "to_version": {
                    "type": ["integer", "null"],
                    "description": "Version number to diff to (newer version). Omit to use the latest version.",
                },
            },
            "required": ["path", "from_version", "to_version"],
        },
    },
}


# ---------------------------------------------------------------------------
# Phase 085 — 3 new tools (D-085-25: 24-tool toolbox)
# Descriptions lead with "Use when:" + "Do not use for:" per D-085-25 to mitigate
# the 24-tool selection-accuracy concern across Google + DeepSeek/Moonshot.
# Copy-verbatim from 085-RESEARCH.md §E (lines 767-862).
# ---------------------------------------------------------------------------

# Phase 085 D-085-17..22 — write_todos tool schema
WRITE_TODOS_TOOL = {
    "type": "function",
    "function": {
        "name": "write_todos",
        "description": (
            "Record or update the task list for a multi-step request so it appears in the user's workspace panel. "
            "Call this WHENEVER the user asks you to plan, track, or work through several steps — call it at the "
            "START of multi-step work and again to flip a todo's status as you complete each step. "
            "Use when: you need to break a complex multi-step task into trackable items the user can see, "
            "or when updating the status of in-flight work. "
            "Do not use for: short single-step answers, scratch notes, or per-message reminders. "
            "Do NOT just narrate the steps in text — a narrated list the user cannot see is not tracking; "
            "this tool persists a real, user-visible list. "
            "Semantics: full-state-replace — every call OVERWRITES the entire todo list. "
            "Include all current todos (both new and existing) in every call, not just the changes. "
            "Status values: pending | in_progress | completed."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "todos": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": {"type": "string", "description": "Stable client-supplied identifier (e.g. 't1', 't2'). Reuse the same id when updating status of an existing todo."},
                            "content": {"type": "string", "description": "What needs to be done. One sentence."},
                            "status": {"type": "string", "enum": ["pending", "in_progress", "completed"]},
                            "parent_id": {"type": ["string", "null"], "description": "Optional id of a parent todo for nesting. Omit or null for top-level items."},
                            "order_index": {"type": "integer", "description": "Display order within the list. 0-indexed."},
                        },
                        "required": ["id", "content", "status", "parent_id", "order_index"],
                    },
                },
            },
            "required": ["todos"],
        },
    },
}


# Phase 085 D-085-08..16 — task sub-agent tool schema
TASK_TOOL = {
    "type": "function",
    "function": {
        "name": "task",
        "description": (
            "Spawn a focused sub-agent to perform a delegated piece of work and return a summary. "
            "Use when: the work has a clear bounded objective that benefits from its own short context "
            "(e.g. 'find all mentions of X across these documents and summarize') and would otherwise pollute "
            "the main conversation. "
            "Do not use for: simple lookups (use search_documents directly), or for tasks that need "
            "to ask the user a question (sub-agents cannot call ask_user). "
            "Sub-agents cannot call task(), ask_user(), or write_todos(). "
            "Max sub-agent steps clamped server-side; long-running work should still be broken into multiple task() calls."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "description": {"type": "string", "description": "Required. What the sub-agent should accomplish, in one or two sentences."},
                "instructions": {"type": ["string", "null"], "description": "Optional task-specific guidance APPENDED to the server's base sub-agent prompt."},
                "tools": {
                    "type": ["array", "null"],
                    "items": {"type": "string"},
                    "description": "Optional. Restrict the sub-agent's toolset to these tool names (must be a subset of your own tools). Omit/null = use a safe read-only default set.",
                },
                "max_steps": {"type": ["integer", "null"], "description": "Optional. Maximum sub-agent iterations. Server clamps to a hard maximum."},
            },
            "required": ["description", "instructions", "tools", "max_steps"],
        },
    },
}


# Phase 085 D-085-01..07 — ask_user pause/resume tool schema
ASK_USER_TOOL = {
    "type": "function",
    "function": {
        "name": "ask_user",
        "description": (
            "Pause and ask the user a question. The agent waits for the user's response (up to a timeout) "
            "before continuing. "
            "Use when: you have a true blocker that requires a decision only the user can make "
            "(e.g. 'which of these 3 files should I overwrite?'), when you need information only the user has, "
            "or when proceeding without confirmation would risk an ambiguous or destructive action. "
            "When the user explicitly asks you to confirm before acting, CALL this tool — do not just narrate "
            "the question in prose and assume an answer. "
            "Do not use for: clarification questions you can answer yourself, or as a substitute for "
            "writing final assistant content (just respond normally instead). Only call it for a genuine "
            "blocker; when the intent is clear and safe, proceed without asking. "
            "Always pass a clear, specific prompt — never ask 'are you sure?' without context."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "prompt": {"type": "string", "description": "Required. The question to show the user. Be specific."},
                "options": {
                    "type": ["array", "null"],
                    "items": {"type": "string"},
                    "description": "Optional. Multiple-choice options. If provided, panel renders as buttons; user can still type free-text.",
                },
                "timeout_seconds": {"type": ["integer", "null"], "description": "Optional. Maximum seconds to wait. Server clamps."},
            },
            "required": ["prompt", "options", "timeout_seconds"],
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
    tools = [SEARCH_DOCUMENTS_TOOL, QUERY_DOCUMENTS_TOOL, QUERY_DOCUMENTS_BY_VIEW_TOOL,
             GET_RELATED_DOCUMENTS_TOOL,
             LS_TOOL, TREE_TOOL, GREP_TOOL, GLOB_TOOL, READ_DOCUMENT_TOOL, ANALYZE_DOCUMENT_TOOL,
             LOAD_SKILL_TOOL, SAVE_SKILL_TOOL, READ_SKILL_FILE_TOOL,
             REMEMBER_TOOL, RECALL_TOOL, QUERY_TABLES_TOOL,
             WORKSPACE_WRITE_TOOL, WORKSPACE_READ_TOOL, WORKSPACE_LIST_TOOL,
             WORKSPACE_DELETE_TOOL, WORKSPACE_DIFF_TOOL,
             # Phase 085 — D-085-25 — 3 new tools (24-tool toolbox after this line)
             WRITE_TODOS_TOOL, TASK_TOOL, ASK_USER_TOOL]
    # Phase 116 (REL-04) — D-116-10 / SC#1: get_related_documents is Deep-visible here
    # AND registered in tool_dispatcher._TOOL_REGISTRY (the dual-wiring contract — a
    # registry entry the model never SEES is dead; the Phase-101 render_template
    # half-wired bug, guarded by the 115 precedent). MUST be in BOTH.
    # Phase 115 (VIEW-07) — D-115-8: Deep-visible so the model actually SEES it (SC#1).
    # The inverse of render_template (registered in _TOOL_REGISTRY but NOT advertised here —
    # harness-only); this tool MUST be in BOTH. apply_tool_budget only trims on the HARNESS
    # path (Google max_tools:16); Deep stays byte-identical with this tool present.
    web_enabled = effective.web_search_enabled if effective is not None else settings.web_search_enabled
    sandbox_enabled = effective.sandbox_enabled if effective is not None else settings.sandbox_enabled
    if web_enabled:
        tools.append(WEB_SEARCH_TOOL)
    if sandbox_enabled:
        tools.append(EXECUTE_CODE_TOOL)
    return tools


def apply_tool_budget(
    schemas: list[dict],
    model: str,
    whitelist: "frozenset[str] | None",
) -> list[dict]:
    """Phase 091 — D-05 layer 1 whitelist filter + TOOL-05 per-provider budget cap.

    Pure function (no side effects). Used by the harness phase executor (Plan 03)
    to build a per-phase ``tools_override``::

        apply_tool_budget(get_tools(user_settings), model, phase_whitelist)

    Two stages:

    1. **Whitelist filter (D-05 layer 1):** when ``whitelist`` is not None, keep only
       the schemas whose ``function.name`` is in the whitelist — the model only SEES
       the allowed tools. ``None`` (Deep Mode) skips the filter entirely.
    2. **Budget cap (TOOL-05):** read ``MODEL_CAPABILITIES[model].max_tools``. When
       that ``max_tools is None`` (absent / unregistered model) OR the list already
       fits, return as-is. Otherwise drop schemas from the LOW-priority end (registry/
       assembly order — last appended = lowest priority, A3) until it fits, but NEVER
       drop a whitelisted tool (whitelist tools are the point of the phase). If the
       whitelist alone exceeds the cap, keep ALL whitelist tools (the structural
       requirement wins over the soft ceiling) and log a warning.

    IMPORTANT (SC#2 / Phase 089 byte-identical invariant): this function is NOT wired
    into any Deep-Mode/default ``get_tools()`` call site in 091 — it is invoked ONLY
    from the harness executor (phase config present). Google's ``max_tools`` ceiling
    therefore applies only on the harness path; Explorer/General/Deep-Mode tool sets —
    including Google — stay byte-identical. Order is preserved throughout.
    """
    # Stage 1 — D-05 layer 1 whitelist filter (None = Deep Mode = no filter).
    if whitelist is not None:
        schemas = [t for t in schemas if t["function"]["name"] in whitelist]

    # Stage 2 — TOOL-05 budget cap.
    max_tools = MODEL_CAPABILITIES.get(model, {}).get("max_tools")
    if max_tools is None or len(schemas) <= max_tools:
        return schemas

    # Over budget: drop lowest-priority (latest in assembly order) NON-whitelist tools
    # first. Iterate from the end so the earliest (highest-priority) tools survive.
    wl = whitelist or frozenset()
    kept: list[dict] = []
    dropped_protected = False
    # Walk in reverse, dropping non-whitelist tools until we fit; always keep whitelist.
    surviving = list(schemas)
    # Indices of droppable (non-whitelist) tools, lowest-priority (last) first.
    droppable = [
        i for i in range(len(surviving) - 1, -1, -1)
        if surviving[i]["function"]["name"] not in wl
    ]
    to_drop: set[int] = set()
    for i in droppable:
        if len(surviving) - len(to_drop) <= max_tools:
            break
        to_drop.add(i)
    kept = [t for idx, t in enumerate(surviving) if idx not in to_drop]

    if len(kept) > max_tools:
        # Only whitelist tools remain and they still exceed the cap — the structural
        # requirement (the phase NEEDS these tools) wins over the soft ceiling.
        dropped_protected = True

    if dropped_protected:
        logger.warning(
            "apply_tool_budget: whitelist (%d tools) exceeds model %s max_tools=%d; "
            "retaining all whitelist tools (soft ceiling yields to phase requirement)",
            len(kept), model, max_tools,
        )
    return kept


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
    force_tool_name: str | None = None,
    strict_response_format: bool = False,
) -> tuple:
    """Returns (stream, calling_mode). calling_mode indicates how to parse the response.

    Phase 101.1 (D-05 — TIER-FORCE / TIER-COERCE): the OpenAI-compat gateway adapter
    passes ``force_tool_name`` to FORCE the model to call a named tool
    (``tool_choice={"type":"function","function":{"name":...}}``) and, when
    ``strict_response_format`` is set, requests a token-level guaranteed schema
    (strict ``response_format`` built from the forced tool's parameters). Both are
    ADDITIVE — the defaults (None / False) preserve the byte-identical ``"auto"`` path
    (Deep + every pre-101.1 caller unchanged). This is the openai-compat ADAPTER's own
    request construction — NOT the shared chunk/SSE path (the D-14 RED LINE)."""
    client = get_llm_client(user_settings)
    effective_model = model or (user_settings.llm_model if user_settings else None) or settings.llm_model
    resolved_tokens = _resolve_max_tokens(max_tokens, user_settings)
    token_param = "max_completion_tokens" if _uses_max_completion_tokens(effective_model) else "max_tokens"
    
    calling_mode = resolve_calling_mode(effective_model, user_settings)
    
    effective_tokens = resolved_tokens  # GEN-01: full budget always — no reduction
    
    provider = (user_settings.active_provider if user_settings else "") or settings.llm_provider or ""

    # Phase 123 (WR-06): strip internal ``_``-prefixed markers from each message
    # before they reach ``client.chat.completions.create``. ``_reconstruct_history``
    # stamps ``_pinned_skill`` on load_skill tool-result messages (agent_loop.py) and
    # ``trim_messages_to_fit`` preserves it (it is the de-dupe key in context_window).
    # The Anthropic/Google adapters rebuild messages so the marker is dropped there,
    # but the OpenAI-compat path (OpenAI + OpenRouter + Ollama + DeepSeek) funnels the
    # list straight to the SDK, and OpenAI / several compat providers 400 on unknown
    # top-level message properties. This shallow per-message comprehension is safely
    # DOWNSTREAM of the upstream trim (the pin ORDERING is already baked into the list;
    # only the now-redundant marker is removed). ``content`` is referenced by-reference,
    # NOT deep-copied — it can be large.
    messages = [
        {k: v for k, v in m.items() if not k.startswith("_")} for m in messages
    ]

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

    # Phase 076.2 D-02: Enable DeepSeek V4 thinking mode. reasoning_content
    # round-trip is handled in threads.py agent loop (076.2 Plan 01 Task 1).
    # reasoning_effort="high" is DeepSeek's default (D-04); "max" available
    # but not enabled this phase.
    #
    # Phase 101.1-07 (gap 1a / D-15 / TIER-FORCE-NOTHINK): DeepSeek shares
    # Anthropic's no-force-under-thinking constraint — a named tool_choice WITH
    # thinking ON returns "Thinking mode does not support this tool_choice"
    # (UAT runs 575e7345/a7f415ad). The D-13 two-step already moves reasoning to
    # the gather phase, so the forced emit call runs thinking-OFF. Provider-scoped,
    # inside the forced branch's precondition (force_tool_name is None) — the auto
    # path (force_tool_name None) is byte-identical.
    if (provider == "deepseek" or effective_model.startswith("deepseek-")) and force_tool_name is None:
        kwargs.setdefault("extra_body", {})
        kwargs["extra_body"]["thinking"] = {
            "type": "enabled",
            "reasoning_effort": "high",
        }

    # Phase 101.1 (D-05 — TIER-FORCE): a forced emit names the tool the model MUST
    # call. This branch slots BESIDE the ``"auto"`` branch (additive — force_tool_name
    # is None for every Deep / pre-101.1 caller). It always passes the tools + the
    # named tool_choice; on a NATIVE provider it additionally requests a strict
    # ``response_format`` (token-level guarantee) when ``strict_response_format`` is
    # set. NEVER reached on the auto path (the byte-identical RED LINE).
    if force_tool_name is not None:
        _forced_tools = tools_override if tools_override is not None else get_tools(user_settings)
        # Phase 122 (MP-02 / D-122-04): the function-level ``strict`` flag block
        # (101.1 WR-05 (1)) is REMOVED. It was INERT for DeepSeek (a documented
        # /beta-only feature we never reach) and contributed NOTHING for OpenAI —
        # OpenAI's token-level guarantee comes from the ``response_format`` json_schema
        # built below, not from a function-def flag. Removing it does NOT regress
        # OpenAI force_strict (A4 — proven by test_openai_force_strict_preserved).
        kwargs["tools"] = _forced_tools
        kwargs["tool_choice"] = {
            "type": "function",
            "function": {"name": force_tool_name},
        }
        if strict_response_format:
            # Phase 122 (MP-02 / D-122-04): the hardcoded ``and provider == "openai"``
            # name check is REMOVED — the gate is now TIER-DRIVEN. The caller sets
            # ``strict_response_format`` ONLY for emit_tier=="force_strict" shots, which
            # (post-migration) are OpenAI-only by MEASUREMENT, not by name. So the
            # json_schema response_format is requested whenever strict is asked for, with
            # no provider-name special-case. DeepSeek is now emit_tier=force (never
            # force_strict), so its caller never sets strict_response_format → it never
            # reaches this branch (the old "docs said forceable!" 400 trap can't recur).
            # Build the strict json_schema response_format from the forced tool's
            # parameters. Defensive: only inject when the named tool's schema is
            # present in the tool list.
            _schema = None
            for _t in _forced_tools or []:
                _fn = _t.get("function") if isinstance(_t, dict) else None
                if _fn and _fn.get("name") == force_tool_name:
                    _schema = _fn.get("parameters")
                    break
            if _schema is not None:
                kwargs["response_format"] = {
                    "type": "json_schema",
                    "json_schema": {
                        "name": force_tool_name,
                        "schema": _schema,
                        "strict": True,
                    },
                }
    elif tool_choice == "auto":
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
                # D-09 #3 (BUG-260616-01): gate on the RESOLVED provider, not the model
                # string. The old `"/" in effective_model` slash-gate fired for EVERY
                # `org/model` id — which is exactly how every LM Studio/Ollama model is
                # named (`google/gemma-4-e4b`) — appending `:exacto` + a `response-healing`
                # plugin that 500s the local server. `provider` is resolved upstream
                # (active_provider or settings.llm_provider) so OpenRouter still gets the
                # quality strategy while local providers are left untouched.
                if provider == "openrouter":
                    # Append :exacto for quality routing if not already present
                    if ":exacto" not in effective_model:
                        kwargs["model"] = f"{effective_model}:exacto"
                    # Enable Response Healing plugin
                    kwargs.setdefault("extra_body", {})
                    kwargs["extra_body"]["plugins"] = [{"id": "response-healing"}]
                    # Phase 129 (D-02 / MP-04 — wires the config.py D-15 directive):
                    # require_parameters so OpenRouter excludes upstreams that would
                    # silently drop the tool schema. Strictly inside the quality +
                    # openrouter double-gate — native/xml strategies and every
                    # non-OpenRouter provider stay byte-identical (D-14 RED LINE).
                    kwargs["extra_body"]["provider"] = {"require_parameters": True}
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
