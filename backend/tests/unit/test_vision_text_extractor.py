"""Vision-as-OCR extractor (SEED-226 L1 + L2, and image uploads).

⚠ WHAT THESE TESTS ARE FOR. The dangerous case in SEED-226 is not the scan — a scan fails
loudly and always did. It is the VECTOR DRAWING, which extracts text fine, ingests
`completed`, shows nothing red, and answers a bill-of-quantities question from run-together
room names. So the classifier's `drawing` arm is driven against a synthesised PDF with the
real file's measured shape (thin text + dense geometry), not merely against an empty one.

⛔ NO NETWORK. Every transcription test injects a fake client; nothing here calls a model.
"""
from __future__ import annotations

import base64
import io

import pytest

from app.services.extractors.aspects import vision_text


# ── Fixtures: real PDFs, built in-process ────────────────────────────────────────────

pymupdf = pytest.importorskip("pymupdf")
PIL = pytest.importorskip("PIL")


def _pdf(build) -> bytes:
    doc = pymupdf.open()
    build(doc)
    out = doc.tobytes()
    doc.close()
    return out


def _prose_pdf(pages: int = 2) -> bytes:
    """An ordinary document: plenty of text, no geometry. Must NOT be transcribed."""
    def build(doc):
        for _ in range(pages):
            page = doc.new_page()
            body = "The quick brown fox jumps over the lazy dog. " * 40
            page.insert_textbox(pymupdf.Rect(40, 40, 560, 780), body, fontsize=9)
    return _pdf(build)


def _scan_pdf() -> bytes:
    """A page with no text layer at all and no geometry — the classic scan."""
    def build(doc):
        doc.new_page()
    return _pdf(build)


#: The real drawing's text layer, verbatim from SEED-226's probe (252 chars, one numeral).
#:
#: ⚠ ITS LENGTH IS LOAD-BEARING AND WAS GOT WRONG ONCE. An earlier fixture used a 45-char
#:   stand-in, which falls under `MIN_TEXT_CHARS_PER_PAGE` — so the drawing test passed
#:   through the SCAN arm and the dangerous second arm was never executed at all. A planted
#:   defect that deleted that arm outright left all 23 tests green, which is how the gap was
#:   found. The text must sit ABOVE the scan floor and BELOW the drawing ceiling, exactly as
#:   the measured file does.
_REAL_DRAWING_TEXT = (
    "BED ROOM KITCHEN BED ROOM KITCHEN BED ROOM KITCHEN BED ROOM KITCHEN HALL HALLHALL "
    "HALLBATHBATH BATHBATHVERANDA FIRST FLOORGROUND FLOOR KITCHENKITCHEN HALLHALL "
    "VERANDAVERANDA BED ROOMBED ROOMBATHBATHWASHWASH PASSAGE 6FEET WIDE CAR PARKING"
)


def _drawing_pdf() -> bytes:
    """Thin text plus dense vector geometry — the real AutoCAD floor plan's shape.

    SEED-226 measured the operator's actual drawing at 252 text chars and 2,799 drawing ops
    on one page. This fixture reproduces that RATIO, which is what the classifier keys on.
    """
    def build(doc):
        page = doc.new_page()
        page.insert_textbox(
            pymupdf.Rect(40, 30, 560, 120), _REAL_DRAWING_TEXT, fontsize=7,
        )
        for i in range(600):
            y = 130 + (i % 300)
            page.draw_line(pymupdf.Point(60, y), pymupdf.Point(300, y))
    return _pdf(build)


def _png_bytes(size=(120, 90), color=(200, 30, 30)) -> bytes:
    from PIL import Image
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, format="PNG")
    return buf.getvalue()


class _FakeClient:
    """Records what it was asked, returns a canned transcription per call."""

    def __init__(self, replies=None, raises_on=()):
        self.replies = list(replies or ["TRANSCRIBED"])
        self.raises_on = set(raises_on)
        self.calls: list[dict] = []
        self.chat = self  # so `client.chat.completions` resolves
        self.completions = self

    def create(self, **kwargs):  # noqa: D102
        idx = len(self.calls)
        self.calls.append(kwargs)
        if idx in self.raises_on:
            raise RuntimeError("model exploded")
        text = self.replies[idx] if idx < len(self.replies) else self.replies[-1]

        class _Msg:
            content = text

        class _Choice:
            message = _Msg()

        class _Resp:
            choices = [_Choice()]

        return _Resp()


class _Settings:
    llm_api_key = "sk-test"
    llm_base_url = None
    llm_model = "gpt-4o-mini"
    multimodal_max_vision_calls = 100


# ── Classification ────────────────────────────────────────────────────────────────────


def test_ordinary_document_is_not_a_deficit():
    """⚠ THE FALSE-POSITIVE GUARD. Every paid vision call this module makes is justified by
    this returning None for normal documents."""
    assert vision_text.classify_pdf_deficit(_prose_pdf(), "x" * 4000) is None


def test_scan_with_no_text_layer_is_a_scan():
    d = vision_text.classify_pdf_deficit(_scan_pdf(), "")
    assert d is not None
    assert d.kind == "scan"
    assert d.pages == 1


def test_vector_drawing_with_thin_text_is_a_drawing():
    """⭐ THE CASE THE PRODUCT SILENTLY GOT WRONG. Text extracted, nothing errored, and the
    numbers were line-art the text layer never saw."""
    raw = _drawing_pdf()
    d = vision_text.classify_pdf_deficit(raw, _REAL_DRAWING_TEXT)
    assert d is not None
    assert d.kind == "drawing"
    assert d.drawing_ops >= vision_text.DRAWING_OPS_PER_PAGE
    # ⛔ THE POSITIVE CONTROL FOR THE ARM ITSELF. If this page's text ever falls under the
    #    scan floor, the assertion above would pass through the WRONG arm and a deleted
    #    drawing arm would go unnoticed — which is exactly what happened once.
    assert d.text_chars >= vision_text.MIN_TEXT_CHARS_PER_PAGE
    assert d.text_chars < vision_text.DRAWING_MAX_TEXT_CHARS_PER_PAGE


def test_caller_text_is_a_floor_so_a_readable_document_is_never_re_transcribed():
    """A caller that read the document fine with another engine must win over the page scan.

    ⚠ This is the guard against re-transcribing something already readable — the most
    expensive possible false positive."""
    assert vision_text.classify_pdf_deficit(_scan_pdf(), "y" * 5000) is None


def test_unopenable_bytes_classify_as_nothing_rather_than_raising():
    assert vision_text.classify_pdf_deficit(b"not a pdf at all", "") is None


# ── Rendering ─────────────────────────────────────────────────────────────────────────


def test_render_returns_one_b64_png_per_page_within_budget():
    pages = vision_text.render_pdf_pages_b64(_prose_pdf(pages=3), max_pages=2)
    assert len(pages) == 2
    for p in pages:
        assert base64.b64decode(p)[:8] == b"\x89PNG\r\n\x1a\n"


def test_render_of_a_zero_budget_makes_no_pages():
    assert vision_text.render_pdf_pages_b64(_prose_pdf(), max_pages=0) == []


def test_render_of_broken_bytes_returns_empty_rather_than_raising():
    assert vision_text.render_pdf_pages_b64(b"garbage", max_pages=3) == []


def test_image_normalises_to_png_and_downscales_the_long_edge():
    b64 = vision_text.image_to_png_b64(_png_bytes(size=(4000, 1000)), max_edge_px=500)
    from PIL import Image
    img = Image.open(io.BytesIO(base64.b64decode(b64)))
    assert img.format == "PNG"
    assert max(img.size) == 500


def test_transparency_is_flattened_onto_white_and_the_content_survives():
    """⚠ A model reads black-on-transparent as black-on-black and transcribes nothing.

    ⛔ THIS TEST WAS VACUOUS ONCE AND THE PLANT CAUGHT IT. An earlier version used a fully
       transparent image and asserted the result was white — which is true whether the paste
       happens or not, so deleting the flatten left it green. It now needs BOTH halves:
       the transparent margin must become WHITE (flattening happened) and the opaque black
       square must still be BLACK (the content was not thrown away with the alpha).
    """
    from PIL import Image
    src = Image.new("RGBA", (40, 40), (0, 0, 0, 0))
    for x in range(15, 25):
        for y in range(15, 25):
            src.putpixel((x, y), (0, 0, 0, 255))
    buf = io.BytesIO()
    src.save(buf, format="PNG")

    b64 = vision_text.image_to_png_b64(buf.getvalue(), max_edge_px=40)
    img = Image.open(io.BytesIO(base64.b64decode(b64)))
    assert img.mode == "RGB"
    assert img.getpixel((2, 2)) == (255, 255, 255), "transparent margin was not flattened to white"
    assert img.getpixel((20, 20)) == (0, 0, 0), "opaque content was lost with the alpha channel"


def test_non_image_bytes_raise_valueerror():
    with pytest.raises(ValueError):
        vision_text.image_to_png_b64(b"still not an image")


# ── Transcription ─────────────────────────────────────────────────────────────────────


def test_transcription_asks_for_text_not_a_description():
    """⭐ THE DIFFERENCE FROM `describe_image`. A caption of a document that is 100% figure
    reads as knowledge while preserving almost none of it (SEED-006: ~5%)."""
    client = _FakeClient(["HELLO"])
    out = vision_text.transcribe_pages(["ZmFrZQ=="], "scan", _Settings(), client=client)
    assert out == "HELLO"
    prompt = client.calls[0]["messages"][0]["content"][0]["text"]
    assert "Transcribe" in prompt
    assert "verbatim" in prompt
    assert "describe" not in prompt.split("do not ")[0]


def test_drawing_prompt_binds_labels_to_what_they_label():
    client = _FakeClient(["X"])
    vision_text.transcribe_pages(["ZmFrZQ=="], "drawing", _Settings(), client=client)
    prompt = client.calls[0]["messages"][0]["content"][0]["text"]
    assert "KEEP EACH LABEL ATTACHED TO WHAT IT LABELS" in prompt
    assert "Never estimate or infer a dimension that is not printed" in prompt


def test_detail_is_high_because_a_dimension_string_does_not_survive_downsampling():
    client = _FakeClient(["X"])
    vision_text.transcribe_pages(["ZmFrZQ=="], "scan", _Settings(), client=client)
    assert client.calls[0]["messages"][0]["content"][1]["image_url"]["detail"] == "high"


def test_multiple_pages_are_marked_and_joined():
    client = _FakeClient(["ONE", "TWO"])
    out = vision_text.transcribe_pages(["a", "b"], "scan", _Settings(), client=client)
    assert "## Page 1" in out and "ONE" in out
    assert "## Page 2" in out and "TWO" in out


def test_a_single_page_carries_no_page_marker():
    client = _FakeClient(["ONLY"])
    assert vision_text.transcribe_pages(["a"], "scan", _Settings(), client=client) == "ONLY"


def test_one_failed_page_costs_that_page_and_not_the_document():
    """⚠ DRIVEN, not asserted in a docstring: page 1 raises, page 2 still lands."""
    client = _FakeClient(["DEAD", "SURVIVOR"], raises_on={0})
    out = vision_text.transcribe_pages(["a", "b"], "scan", _Settings(), client=client)
    assert "SURVIVOR" in out
    assert "DEAD" not in out


def test_no_pages_transcribes_to_empty_without_calling_a_model():
    client = _FakeClient(["NEVER"])
    assert vision_text.transcribe_pages([], "scan", _Settings(), client=client) == ""
    assert client.calls == []


# ── Budget ────────────────────────────────────────────────────────────────────────────


def test_budget_reuses_the_existing_vision_cap_rather_than_a_second_knob():
    class Capped(_Settings):
        multimodal_max_vision_calls = 3

    assert vision_text.page_budget(Capped(), 40) == 3


def test_budget_never_exceeds_the_hard_cap_however_high_the_setting():
    class Unbounded(_Settings):
        multimodal_max_vision_calls = 100000

    assert vision_text.page_budget(Unbounded(), 10000) == vision_text.MAX_PAGES_HARD_CAP


def test_budget_of_a_short_document_is_its_own_page_count():
    assert vision_text.page_budget(_Settings(), 4) == 4


# ── Provenance ────────────────────────────────────────────────────────────────────────


def test_provenance_marks_the_text_advisory_so_it_can_never_pass_as_a_text_layer():
    """⛔ THE FAILURE SEED-226 EXISTS TO PREVENT, one layer up: a transcription that cannot
    be told apart from a parsed text layer, then priced off."""
    rec = vision_text.provenance("drawing", 3)
    assert rec["engine"] == "vision"
    assert rec["advisory"] is True
    assert rec["pages_transcribed"] == 3


def test_provenance_carries_the_evidence_that_triggered_it():
    d = vision_text.classify_pdf_deficit(_drawing_pdf(), "")
    rec = vision_text.provenance("drawing", 1, d)
    assert rec["detected"]["drawing_ops"] >= vision_text.DRAWING_OPS_PER_PAGE
    assert rec["detected"]["kind"] == "drawing"


# ── Routing: the door, and which branch a mime reaches ────────────────────────────────
#
# ⚠ THE MODULE-LEVEL CONTRACT THESE GUARD. `extract_text` dispatches on mime, and TWO of the
#   image-shaped mimes are not images: `image/vnd.dxf` is an AutoCAD drawing. Sending it to a
#   vision model would transcribe nothing while the real parser sat one branch away.

def test_image_mimes_are_actually_accepted_by_the_upload_gate():
    """Until this shipped, an uploaded `.png` was refused here — so the vision machinery that
    already described images pulled OUT of a PDF could never be reached by one uploaded alone."""
    from app.api.documents import ALLOWED_MIME_TYPES, IMAGE_MIME_TYPES

    assert IMAGE_MIME_TYPES
    assert IMAGE_MIME_TYPES <= ALLOWED_MIME_TYPES


def test_dxf_is_not_treated_as_an_image_despite_its_image_mime():
    """⛔ `image/vnd.dxf` is a CAD file wearing an `image/*` label."""
    from app.api.documents import IMAGE_MIME_TYPES

    assert "image/vnd.dxf" not in IMAGE_MIME_TYPES


def test_every_image_extension_override_maps_into_the_image_mime_set():
    """A browser that reports `application/octet-stream` for a `.jpg` must still land in the
    image branch — the override table is what makes that true."""
    from app.api.documents import IMAGE_MIME_TYPES, _EXT_MIME_OVERRIDES

    for ext in (".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff", ".bmp", ".gif"):
        assert _EXT_MIME_OVERRIDES.get(ext) in IMAGE_MIME_TYPES, ext


def test_extract_text_routes_an_image_to_transcription_not_to_a_caption(monkeypatch):
    """Driven through the REAL `extract_text`, so the branch order is exercised, not assumed."""
    from app.api import documents as docs

    seen: dict = {}

    def _fake_transcribe(pages, kind, settings, client=None):
        seen["pages"], seen["kind"] = pages, kind
        return "READ OFF THE PIXELS"

    monkeypatch.setattr(vision_text, "transcribe_pages", _fake_transcribe)
    monkeypatch.setattr(docs, "load_app_settings", lambda: _Settings())

    out = docs.extract_text(_png_bytes(), "image/png")
    assert out == "READ OFF THE PIXELS"
    assert seen["kind"] == "scan"
    assert len(seen["pages"]) == 1


def test_extract_text_on_unreadable_image_bytes_returns_empty_rather_than_raising():
    """An empty return lets the caller's normal empty-text path explain it, instead of a 500."""
    from app.api import documents as docs

    assert docs.extract_text(b"not an image", "image/png") == ""


def test_the_pdf_empty_message_no_longer_promises_ocr_the_product_lacks():
    """⭐ SEED-226 WAS PLANTED ON THIS SENTENCE. It named a capability that did not exist."""
    from app.api.documents import empty_text_message

    msg = empty_text_message("application/pdf")
    assert "OCR" not in msg
    assert "image" in msg.lower() or "scan" in msg.lower()


def test_an_image_with_no_text_gets_a_sentence_that_does_not_imply_a_broken_importer():
    from app.api.documents import empty_text_message

    msg = empty_text_message("image/png")
    assert "no text" in msg.lower()
    assert "still stored" in msg.lower()


# ── Model resolution: the bug that made every vision call go to one vendor ────────────
#
# ⛔ THE EXPRESSION THIS REPLACED WAS `env_settings.vision_model or app_settings.llm_model`,
#   and `config.py` defaulted `vision_model` to the literal "gpt-4o-mini". The left side was
#   ALWAYS truthy, so the right side was DEAD CODE. Every vision call this product ever made
#   went to gpt-4o-mini — regardless of the configured provider, and including installs with
#   no OpenAI key, where it failed and the soft-failure path swallowed it.

class _SettingsWithVision(_Settings):
    vision_model = "my-vision-model"


def test_the_db_setting_wins():
    assert vision_text.resolve_vision_model(_SettingsWithVision()) == "my-vision-model"


def test_an_unset_vision_model_falls_through_to_the_active_chat_model(monkeypatch):
    """⭐ THE ARM THAT WAS UNREACHABLE. This is the whole point of the fix."""
    from app.config import settings as env_settings

    monkeypatch.setattr(env_settings, "vision_model", "", raising=False)
    assert vision_text.resolve_vision_model(_Settings()) == "gpt-4o-mini"  # == llm_model


def test_the_env_var_still_overrides_for_an_operator_who_already_set_it(monkeypatch):
    from app.config import settings as env_settings

    monkeypatch.setattr(env_settings, "vision_model", "env-pinned", raising=False)
    assert vision_text.resolve_vision_model(_Settings()) == "env-pinned"


def test_whitespace_only_settings_are_treated_as_unset(monkeypatch):
    """A model name of spaces is a typo, not a choice — it must not reach the API."""
    from app.config import settings as env_settings

    monkeypatch.setattr(env_settings, "vision_model", "   ", raising=False)

    class Spaces(_Settings):
        vision_model = "  "

    assert vision_text.resolve_vision_model(Spaces()) == "gpt-4o-mini"


def test_config_no_longer_pins_a_model_name():
    """⛔ THE REGRESSION FENCE. A non-empty default here makes the fallback unreachable again."""
    from app.config import settings as env_settings

    assert (getattr(env_settings, "vision_model", "") or "").strip() == ""


def test_the_resolved_model_is_what_actually_reaches_the_api():
    """Driven, not inferred from the resolver alone."""
    client = _FakeClient(["X"])
    vision_text.transcribe_pages(["a"], "scan", _SettingsWithVision(), client=client)
    assert client.calls[0]["model"] == "my-vision-model"


# ── Truncation: the 1,000-page question ───────────────────────────────────────────────


def test_a_document_within_budget_carries_no_truncation_note():
    assert vision_text.truncation_note(10, 10) is None
    assert vision_text.truncation_note(3, 10) is None


def test_a_truncated_document_names_exactly_which_pages_are_unknown():
    """⛔ WITHOUT THIS, 50 PAGES OF A 1,000-PAGE SCAN READ AS A COMPLETE DOCUMENT.

    A reader cannot otherwise tell a document that HAS no answer from one whose answer was
    on page 400 — which is the confident-wrong-answer failure SEED-226 exists to prevent.
    """
    note = vision_text.truncation_note(1000, 50)
    assert note is not None
    assert "INCOMPLETE" in note
    assert "50 of 1000" in note
    assert "51-1000" in note


def test_the_budget_respects_the_operator_page_ceiling():
    class Tight(_Settings):
        vision_max_pages = 5

    assert vision_text.page_budget(Tight(), 1000) == 5


def test_provenance_carries_the_truncation_so_the_document_row_records_it():
    d = vision_text.PdfDeficit("scan", 1000, 0, 0)
    rec = vision_text.provenance("scan", 50, d)
    assert rec["truncated"]["total_pages"] == 1000
    assert rec["truncated"]["transcribed"] == 50
    assert "INCOMPLETE" in rec["truncated"]["note"]


def test_a_whole_document_has_no_truncated_key_at_all():
    """An always-present key would make `if provenance.get("truncated")` useless."""
    d = vision_text.PdfDeficit("scan", 4, 0, 0)
    assert "truncated" not in vision_text.provenance("scan", 4, d)


# ── BUG-260905-10 — A TEXT-ONLY MODEL'S REFUSAL WAS STORED AS THE DOCUMENT'S TEXT ────────
#
# ⛔ MEASURED on the operator's library 2026-09-05. `app_settings.vision_model` was NULL, so
#   `resolve_vision_model` fell through to the active chat model — `deepseek-v4-flash`, which
#   has no vision. The OpenAI-compatible endpoint ACCEPTED the call, the model read the
#   transcription prompt, could not see the image part, and replied in fluent English:
#
#       "I cannot see the image content because it was received in an unsupported format…
#        Please re-upload the image in a supported format (such as PNG or JPG)."
#
#   That sentence became the document's text and was embedded. Five files — a scanned TIFF
#   financial statement, a business card, two WebPs and a PNG — each ingested `completed`
#   with one chunk containing nothing but a refusal. The corpus gained a confident lie.
#
# ⚠ THE FORMATS WERE INNOCENT, which is exactly what the refusal made it look like: re-run
#   against gpt-4o, TIFF/WEBP/JPEG/PNG all transcribe (Pillow normalises them to PNG first).
class _S:
    def __init__(self, vision_model="", llm_model=""):
        self.vision_model = vision_model
        self.llm_model = llm_model


def test_the_silent_fallback_refuses_a_model_not_known_to_accept_images():
    """The bug, driven directly: deepseek must NOT be handed an image."""
    from app.services.extractors.aspects.vision_text import resolve_vision_model

    assert resolve_vision_model(_S(llm_model="deepseek-v4-flash")) is None


def test_the_silent_fallback_still_works_for_a_provider_that_does_accept_images():
    """The guard must not cost the working case — gpt-4o transcribed correctly all along."""
    from app.services.extractors.aspects.vision_text import resolve_vision_model

    assert resolve_vision_model(_S(llm_model="gpt-4o")) == "gpt-4o"


def test_an_explicit_setting_is_always_honoured_even_for_an_unknown_provider():
    """Migration 166 exists so the operator can choose. Their choice outranks the guard."""
    from app.services.extractors.aspects.vision_text import resolve_vision_model

    assert resolve_vision_model(_S(vision_model="glm-4.6v", llm_model="deepseek-v4-flash")) == "glm-4.6v"


def test_nothing_configured_at_all_resolves_to_none_rather_than_a_guess():
    from app.services.extractors.aspects.vision_text import resolve_vision_model

    assert resolve_vision_model(_S()) is None


def test_transcribe_pages_spends_no_call_when_no_vision_model_resolves():
    """⚠ The check must sit BEFORE the client is built, or a blind call is still paid for.

    ⚠ THIS TEST RECORDS ACCESS RATHER THAN RAISING ON IT, AND THE DIFFERENCE IS LOAD-BEARING.
      The first version raised `AssertionError` from the fake client — and `transcribe_pages`
      catches `Exception` per page and continues, so the raise was swallowed, the function
      returned "" anyway, and the test passed whether or not the fix was present. A guard that
      cannot fail is not a guard. The flag is checked AFTER the call, outside any except.
    """
    from app.services.extractors.aspects import vision_text

    touched: list[str] = []

    class _RecordingClient:
        def __getattr__(self, name):
            touched.append(name)
            raise RuntimeError("no call should have been attempted")

    out = vision_text.transcribe_pages(
        ["ZmFrZS1iNjQ="], "scan", _S(llm_model="deepseek-v4-flash"), client=_RecordingClient(),
    )
    assert out == ""
    assert touched == [], f"a vision call was attempted with no vision model: {touched}"


# ── BUG-260905-11 — THE MODEL WAS CHOSEN, THE CREDENTIALS WERE NOT ───────────────────────
#
# ⛔ The second half of BUG-260905-10, and it only became visible once the first half was
#   fixed. `resolve_vision_model` picks a MODEL; the client was built from `llm_api_key` /
#   `llm_base_url`, which `config.py:893-903` resolves for the ACTIVE CHAT PROVIDER. Those
#   diverge the moment a vision model comes from a different provider than the chat model.
#
# ⚠ MEASURED on the operator's box 2026-09-06: `vision_model='gpt-4o'` with
#   `llm_provider='deepseek'` sent gpt-4o to DeepSeek's endpoint with DeepSeek's key (NULL
#   here). Every page failed, transcription returned "", and the upload was refused with
#   "This image was read, but no text could be found in it" — false twice over.
def test_credentials_follow_the_vision_model_not_the_chat_model():
    from app.models.user_settings import load_app_settings
    from app.services.extractors.aspects.vision_text import credentials_for_vision

    sim = load_app_settings().model_copy(update={
        "active_provider": "deepseek",
        "vision_model": "gpt-4o",
        "llm_model": "deepseek-v4-flash",
        "llm_api_key": "DEEPSEEK-KEY",
        "llm_base_url": "https://api.deepseek.com",
    })
    creds = credentials_for_vision(sim)
    assert creds.llm_api_key != "DEEPSEEK-KEY", (
        "the vision call would go to DeepSeek's endpoint with DeepSeek's key"
    )
    assert "deepseek" not in (creds.llm_base_url or "")


def test_credentials_are_left_alone_when_the_providers_already_agree():
    """A single-provider deployment must be byte-identical to the pre-fix behaviour."""
    from app.models.user_settings import load_app_settings
    from app.services.extractors.aspects.vision_text import credentials_for_vision

    sim = load_app_settings().model_copy(update={
        "active_provider": "openai",
        "vision_model": "gpt-4o",
        "llm_api_key": "OPENAI-KEY",
        "llm_base_url": "",
    })
    creds = credentials_for_vision(sim)
    assert creds.llm_api_key == "OPENAI-KEY"


def test_credentials_degrade_rather_than_raise_when_no_vision_model_resolves():
    from app.models.user_settings import load_app_settings
    from app.services.extractors.aspects.vision_text import credentials_for_vision

    sim = load_app_settings().model_copy(update={
        "active_provider": "deepseek",
        "vision_model": "",
        "llm_model": "deepseek-v4-flash",
        "llm_api_key": "DEEPSEEK-KEY",
    })
    assert credentials_for_vision(sim).llm_api_key == "DEEPSEEK-KEY"


def test_credentials_helper_never_raises_on_a_settings_object_it_cannot_read():
    """⛔ THE REGRESSION THAT COST A GATE RUN, PINNED.

    The first version of `credentials_for_vision` guarded only `override_provider`, leaving
    `resolve_vision_model` and `get_model_capability` outside the try. `extract_and_store_images`
    passes a MagicMock in unit tests; `get_model_capability` raised on it; the exception
    propagated into that function's own broad try/except, which swallowed it and returned
    BEFORE STORING A SINGLE ROW. Eleven tests went red for a helper that touches no database.

    ⚠ The contract is in its docstring — "must never block an ingest" — so the test asserts the
      contract, not the implementation: hand it something hostile and it must still return.
    """
    from unittest.mock import MagicMock

    from app.services.extractors.aspects.vision_text import credentials_for_vision

    hostile = MagicMock()
    assert credentials_for_vision(hostile) is not None

    class _Exploding:
        def __getattr__(self, name):
            raise RuntimeError(f"settings object refuses {name}")

    exploding = _Exploding()
    assert credentials_for_vision(exploding) is exploding
