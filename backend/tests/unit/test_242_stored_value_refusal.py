"""Phase 242 (SHIP-01, ROADMAP SC#2, D-242-03) — a refusal must name the right CAUSE.

⛔ WHAT WAS WRONG, AND WHY IT READ AS CORRECT.

Today's sentence is:

    "Images read per document must be between 1 and 1000. 0 would silently stop every image
     from being read."

Truthful about the RULE, and actively misleading about the CAUSE. The operator's install held
`multimodal_max_vision_calls = 1001` — a value they never typed — and `SettingsPage.tsx` sent all 24
Search fields on every save, so this sentence appeared while they were editing a retrieval
threshold, pointing at a field on a card they had not opened. It reads as a rejection of what they
just typed. It is not.

⚠ D-242-02 (the changed-fields-only payload) makes the untouched-field path unreachable FROM THE UI.
It does not make it unreachable: the operator can still edit the offending field itself, and any
other client can still send the stored value back. So the sentence is still owed.

⛔ AND IT MUST NEVER BE ABLE TO TURN A 400 INTO A 500. The nicer sentence needs a settings read, and
a settings read can fail. `_range_refusal_detail` wraps it and falls back to today's wording — §4
drives that with a raising monkeypatch, because a nicer error message that can crash is worse than a
blunt one.

⚠ THE CASES MONKEYPATCH `load_app_settings_async`, NEVER SEED A ROW. After migration 178, the local
database CANNOT hold 1001 — the CHECK refuses it. A case that tried to seed one would fail for a
reason that has nothing to do with what it asserts.
"""

import pytest

from app.api import settings as settings_api


class _Stored:
    """A stand-in for the loaded AppSettings row — only the attributes under test."""

    def __init__(self, **values):
        self.__dict__.update(values)


class TestTheHelperExists:
    def test_there_is_one_shared_refusal_seam(self):
        """§1 — ⛔ RED before the fix.

        One helper, not four copies: SC#3's "the class fix, not the instance" applies to the
        SENTENCE as much as to the constraint.
        """
        assert hasattr(settings_api, "_range_refusal_detail"), (
            "no shared refusal helper exists; each bound site raises its own sentence and none of "
            "them can tell a value the operator typed from one that was already stored"
        )


TYPED = "Images read per document must be between 1 and 1000. 0 would silently stop every image from being read."


@pytest.mark.asyncio
class TestTheSentenceNamesTheCause:
    async def test_stored_equals_submitted_says_it_was_ALREADY_set_that_way(self, monkeypatch):
        """§2 — the D-242-03 sentence. Asserted on CONTENT, not on `status_code == 400`.

        `241-HUMAN-UAT.md` row 3: a red banner is exactly what a PASSING refusal looks like, so
        "presence of an error is not evidence of the RIGHT error".
        """
        async def _stored(*_a, **_kw):
            return _Stored(multimodal_max_vision_calls=1001)

        monkeypatch.setattr(settings_api, "load_app_settings_async", _stored)
        detail = await settings_api._range_refusal_detail(
            field="multimodal_max_vision_calls",
            label="Images read per document",
            submitted=1001,
            lo=1,
            hi=1000,
            typed_detail=TYPED,
        )
        assert "was already set to" in detail
        assert "1001" in detail
        assert "Images read per document" in detail
        assert "nothing you just changed" in detail
        # And it must NOT read as a rejection of a fresh edit.
        assert detail != TYPED

    async def test_stored_differs_keeps_TODAYS_sentence_byte_for_byte(self, monkeypatch):
        """§3 — the negative control. The new branch must not swallow the old one.

        When the operator genuinely typed an out-of-range number, today's sentence is the RIGHT
        one — it carries what the bound buys (SEED-227), which the stored-value sentence does not.
        """
        async def _stored(*_a, **_kw):
            return _Stored(multimodal_max_vision_calls=100)

        monkeypatch.setattr(settings_api, "load_app_settings_async", _stored)
        detail = await settings_api._range_refusal_detail(
            field="multimodal_max_vision_calls",
            label="Images read per document",
            submitted=5000,
            lo=1,
            hi=1000,
            typed_detail=TYPED,
        )
        assert detail == TYPED

    async def test_a_failing_settings_read_cannot_turn_a_400_into_a_500(self, monkeypatch):
        """§4 — ⛔ THE ONE THAT MATTERS MOST. A nicer message that can crash is worse than a blunt one."""
        async def _boom(*_a, **_kw):
            raise RuntimeError("pool exhausted")

        monkeypatch.setattr(settings_api, "load_app_settings_async", _boom)
        detail = await settings_api._range_refusal_detail(
            field="multimodal_max_vision_calls",
            label="Images read per document",
            submitted=1001,
            lo=1,
            hi=1000,
            typed_detail=TYPED,
        )
        assert detail == TYPED

    async def test_an_unknown_field_never_reaches_getattr(self, monkeypatch):
        """⛔ WR-04 — the allow-list, and it is about SECRETS, not tidiness.

        The settings object carries ten provider API keys and the Supabase management token, and
        this helper's return value goes straight into an HTTP 400 body. A bare `getattr` on a
        caller-supplied name would put one of those on the wire the moment a future call site
        passed the wrong string. `field` is a literal at all four sites today; the allow-list is
        what keeps that true rather than hoping it stays true.
        """
        async def _secrets(*_a, **_kw):
            return _Stored(openai_api_key="sk-THE-REAL-KEY", multimodal_max_vision_calls=1001)

        monkeypatch.setattr(settings_api, "load_app_settings_async", _secrets)
        detail = await settings_api._range_refusal_detail(
            field="openai_api_key",
            label="OpenAI key",
            submitted="sk-THE-REAL-KEY",
            lo=1,
            hi=10,
            typed_detail=TYPED,
        )
        assert detail == TYPED
        assert "sk-THE-REAL-KEY" not in detail

    async def test_the_allow_list_matches_the_bounds_that_ship(self):
        """The allow-list may not silently narrow: every detected numeric bound must be on it."""
        import importlib.util
        from pathlib import Path

        detector_path = Path(__file__).with_name(
            "test_242_settings_bounds_have_schema_constraints.py"
        )
        spec = importlib.util.spec_from_file_location("_bounds_detector2", detector_path)
        detector = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(detector)
        detected = detector.bounded_fields(detector.SETTINGS_PY.read_text(encoding="utf-8"))
        missing = sorted(detected - set(settings_api._BOUNDED_SETTINGS_FIELDS))
        assert missing == [], (
            f"{missing} are bounded in api/settings.py but absent from _BOUNDED_SETTINGS_FIELDS, "
            "so their refusal can never name the stored value — it silently falls back."
        )

    async def test_a_missing_attribute_falls_back_rather_than_raising(self, monkeypatch):
        """The other failure shape: a settings object that predates the column entirely."""
        async def _stored(*_a, **_kw):
            return _Stored()  # no attributes at all

        monkeypatch.setattr(settings_api, "load_app_settings_async", _stored)
        detail = await settings_api._range_refusal_detail(
            field="multimodal_max_vision_calls",
            label="Images read per document",
            submitted=1001,
            lo=1,
            hi=1000,
            typed_detail=TYPED,
        )
        assert detail == TYPED

    @pytest.mark.parametrize(
        "field,label,lo,hi,stored",
        [
            ("multimodal_max_vision_calls", "Images read per document", 1, 1000, 1001),
            ("vision_max_pages", "Pages read per document", 1, 500, 900),
            ("source_max_file_size_mb", "Largest file a connected source may import", 1, 50, 99),
            ("hnsw_ef_search", "Search breadth", 10, 1000, 5),
        ],
    )
    async def test_every_bounded_field_gets_its_own_stored_value_sentence(
        self, monkeypatch, field, label, lo, hi, stored
    ):
        """§5 — ALL FOUR, parameterised.

        ⚠ An assertion covering only the first field would let the class fix ship as an instance
        fix — which is precisely the failure ROADMAP SC#3 names.
        """
        async def _stored(*_a, **_kw):
            return _Stored(**{field: stored})

        monkeypatch.setattr(settings_api, "load_app_settings_async", _stored)
        detail = await settings_api._range_refusal_detail(
            field=field, label=label, submitted=stored, lo=lo, hi=hi, typed_detail="TYPED-SENTINEL",
        )
        assert "was already set to" in detail
        assert str(stored) in detail
        assert label in detail
        assert detail != "TYPED-SENTINEL"


class TestTheFourSitesUseTheHelper:
    """The seam is wired, not merely present — a helper nobody calls is a helper that does nothing."""

    def test_every_bound_site_routes_its_detail_through_it(self):
        """⚠ COUNTED AGAINST THE DETECTED BOUNDS, NOT AGAINST THE LITERAL 4.

        An earlier version asserted `calls == 4`, and the phase verifier caught why that is weak:
        **a FIFTH bound added without the helper leaves the count at 4 and passes silently** — the
        exact class-fix-shipping-as-an-instance-fix failure ROADMAP SC#3 names. The expected number
        is now derived from the same `ast` detector `test_242_settings_bounds_have_schema_constraints.py`
        uses, so adding a bound raises the requirement automatically.
        """
        import importlib.util
        import inspect
        from pathlib import Path

        detector_path = Path(__file__).with_name(
            "test_242_settings_bounds_have_schema_constraints.py"
        )
        spec = importlib.util.spec_from_file_location("_bounds_detector", detector_path)
        detector = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(detector)

        settings_source = detector.SETTINGS_PY.read_text(encoding="utf-8")
        expected = len(detector.bounded_fields(settings_source))
        calls = inspect.getsource(settings_api.update_settings).count("_range_refusal_detail(")

        assert calls == expected, (
            f"api/settings.py has {expected} numeric bound(s) but only {calls} of them build their "
            f"refusal through the shared helper. A bound that raises its own bare sentence cannot "
            f"tell a value the operator typed from one that was already stored — which is the "
            f"defect D-242-03 exists to fix, reappearing on a new field."
        )

    def test_not_one_of_the_seed_comment_blocks_was_deleted(self):
        """⛔ The comment blocks explain what each bound BUYS. They are the deliverable, not decoration."""
        import inspect

        source = inspect.getsource(settings_api)
        for marker in ("SEED-227", "SEED-226", "SEED-258"):
            assert marker in source, f"{marker}'s comment block was deleted from settings.py"


@pytest.mark.asyncio
class TestAnEmptyBodyIsASuccessfulNoOp:
    """⚠ `{}` becomes the MOST COMMON request shape on the Search tab after D-242-02.

    `save_app_settings` returns True on an empty `clean` dict (`user_settings.py`: "nothing to
    persist is a successful no-op"), so `PUT /settings` does not 500 — but "someone checked once"
    is not a fence, and this is now the default path.
    """

    async def test_save_app_settings_treats_an_empty_update_as_success(self):
        from app.models.user_settings import save_app_settings

        assert await save_app_settings({}) is True
