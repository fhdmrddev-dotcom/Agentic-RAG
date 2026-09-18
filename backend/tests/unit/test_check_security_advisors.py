"""Unit tests for scripts/check-security-advisors.sh (Phase 248 / CRED-04)."""

import os
import shutil
import subprocess
from pathlib import Path
import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
SCRIPT_PATH = REPO_ROOT / "scripts" / "check-security-advisors.sh"
FIXTURES_DIR = Path(__file__).parent.parent / "fixtures" / "security_advisors"


def find_bash():
    """Find Git bash executable on Windows or bash on POSIX."""
    git_bash = Path("C:/Program Files/Git/bin/bash.exe")
    if git_bash.exists():
        return str(git_bash)
    bash = shutil.which("bash")
    if bash and "system32" not in bash.lower():
        return bash
    return None


@pytest.fixture(scope="module")
def bash_exe():
    exe = find_bash()
    if not exe:
        pytest.skip("bash executable not found on system")
    return exe


def run_script(bash_exe, args=None, env=None):
    """Run check-security-advisors.sh with given args and environment."""
    cmd = [bash_exe, str(SCRIPT_PATH)]
    if args:
        cmd.extend(args)
    base_env = os.environ.copy()
    if env:
        base_env.update(env)
    res = subprocess.run(
        cmd,
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
        env=base_env,
    )
    return res


def test_check_security_advisors_clean(bash_exe):
    """Clean security advisors findings must exit 0 and report PASS."""
    clean_file = FIXTURES_DIR / "clean.json"
    assert clean_file.exists()

    res = run_script(bash_exe, ["--file", str(clean_file)])
    assert res.returncode == 0, f"Expected 0, got {res.returncode}. Output:\n{res.stdout}\n{res.stderr}"
    assert "RESULT: PASS" in res.stdout
    assert "0 error-level security advisor findings" in res.stdout


def test_check_security_advisors_warnings_only(bash_exe):
    """Warning-level security advisors findings must exit 0 and be non-blocking."""
    warn_file = FIXTURES_DIR / "warnings_only.json"
    assert warn_file.exists()

    res = run_script(bash_exe, ["--file", str(warn_file)])
    assert res.returncode == 0, f"Expected 0, got {res.returncode}. Output:\n{res.stdout}\n{res.stderr}"
    assert "[WARN]" in res.stdout
    assert "unindexed_foreign_keys" in res.stdout
    assert "RESULT: PASS" in res.stdout


def test_check_security_advisors_error_finding(bash_exe):
    """Error-level security advisors findings must exit 1 and report FAIL."""
    error_file = FIXTURES_DIR / "error_finding.json"
    assert error_file.exists()

    res = run_script(bash_exe, ["--file", str(error_file)])
    assert res.returncode == 1, f"Expected 1, got {res.returncode}. Output:\n{res.stdout}\n{res.stderr}"
    assert "[ERROR]" in res.stdout
    assert "anon_executable_function" in res.stdout
    assert "RESULT: FAIL" in res.stderr


def test_check_security_advisors_missing_file(bash_exe):
    """Specifying a nonexistent mock file must exit 1."""
    res = run_script(bash_exe, ["--file", "nonexistent_file_path_12345.json"])
    assert res.returncode == 1
    assert "ERROR: Mock file not found" in res.stderr


def test_check_security_advisors_missing_token(bash_exe):
    """Running without SUPABASE_ACCESS_TOKEN must exit 1 with descriptive error."""
    clean_env = {
        "SUPABASE_ACCESS_TOKEN": "",
        "MOCK_SECURITY_ADVISORS_FILE": "",
    }
    res = run_script(bash_exe, ["proj_test_ref_123"], env=clean_env)
    assert res.returncode == 1
    assert "SUPABASE_ACCESS_TOKEN environment variable is required" in res.stderr


def test_check_security_advisors_missing_ref(bash_exe):
    """Running without project ref or SUPABASE_URL must exit 1."""
    clean_env = {
        "SUPABASE_PROJECT_REF": "",
        "SUPABASE_URL": "",
        "SUPABASE_ACCESS_TOKEN": "sbp_mock_token",
        "MOCK_SECURITY_ADVISORS_FILE": "",
    }
    res = run_script(bash_exe, [], env=clean_env)
    assert res.returncode == 1
    assert "Project reference not specified" in res.stderr
