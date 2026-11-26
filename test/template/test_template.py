"""chromokit's copier template (copier.yml, template/), rendered and applied.

    uv run --no-project --with pytest --with pyyaml pytest test/template

- **Rendered** with the answers of each Python repository of the project
  (test/fixtures/template/answers): actionlint and zizmor pass on the
  workflows, every TOML and YAML file parses, CITATION.cff validates, the
  rendered tests/test_docs.py passes ruff at the repository's line length,
  and nothing of the template's own syntax is left.
- **Applied** to three sample packages (test/fixtures/template/samples) as a
  repository applies it: the template, chromokit's docs and report kits, the
  package's own dependencies; then what its CI runs: `uv lock`, the tests,
  ruff, ty, the check of pre-commit's ruff, pre-commit, the docs' build and
  `chromokit check`, bump-my-version's dry run, the build and twine, and the
  install job's own scripts.

Every tool runs through uvx or uv, at a pinned version, and node runs
chromokit's command line. The template is rendered from the working tree
(--vcs-ref HEAD).
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import tomllib
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / "test" / "fixtures" / "template"
ANSWERS = sorted((FIXTURES / "answers").glob("*.yml"))
SAMPLES = sorted(path.name for path in (FIXTURES / "samples").iterdir())

COPIER = "copier==9.19.1"
ACTIONLINT = "actionlint-py==1.7.12.25"
#: The shellcheck actionlint runs on every script: without one on PATH, it
#: skips them silently (GitHub's runners have one, a container may not).
SHELLCHECK = "shellcheck-py==0.11.0.1"
ZIZMOR = "zizmor==1.33.1"
RUFF = "ruff==0.17.4"
CFFCONVERT = "cffconvert==2.0.0"
TWINE = "twine==7.0.0"
#: The conventions' lint rules (CONVENTIONS.md § 5).
RULES = ["--select", "E,W,F,I,B,UP,SIM,RUF", "--ignore", "E501"]
#: Each sample's own dependencies, which a repository writes itself.
DEPENDENCIES = {"click": ["click>=8.1"], "scripts": ["click>=8.1"], "docopt": ["docopt-ng>=0.9"]}

pytestmark = pytest.mark.skipif(
    shutil.which("uv") is None or shutil.which("node") is None, reason="needs uv and node"
)


def run(*args, cwd=None, env=None, check=True):
    """A command, its output kept; a failure shows it."""
    result = subprocess.run(
        [str(arg) for arg in args], cwd=cwd, env=env, capture_output=True, text=True, check=False
    )
    if check and result.returncode != 0:
        pytest.fail(f"{' '.join(map(str, args))} exited {result.returncode}:\n{result.stdout}\n{result.stderr}")
    return result


def uvx(*args, **kwargs):
    return run("uvx", "--quiet", *args, **kwargs)


def render(answers, dest, *extra):
    """The template, rendered from the working tree into dest."""
    uvx(COPIER, "copy", "--quiet", "--vcs-ref", "HEAD", "--defaults", "--data-file", answers, *extra, ROOT, dest)


# ---------------------------------------------------------------------------
# Rendered with each repository's answers
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def renders(tmp_path_factory):
    out = tmp_path_factory.mktemp("renders")
    for answers in ANSWERS:
        dest = out / answers.stem
        render(answers, dest)
        run("git", "init", "-q", dest)
    return out


@pytest.fixture(params=[path.stem for path in ANSWERS])
def rendered(request, renders):
    answers = yaml.safe_load((FIXTURES / "answers" / f"{request.param}.yml").read_text())
    return renders / request.param, answers


def test_every_answer_file_answers_every_question(rendered):
    """--defaults never decides for a repository: each file answers each
    question it is asked."""
    path, answers = rendered
    config = yaml.safe_load((ROOT / "copier.yml").read_text())
    recorded = yaml.safe_load((path / ".copier-answers.yml").read_text())
    for question, spec in config.items():
        if question.startswith("_") or spec.get("when") is False or question not in recorded:
            continue
        assert question in answers, f"{path.name} does not answer {question}"


def test_what_is_written(rendered):
    path, answers = rendered
    files = {str(file.relative_to(path)) for file in path.rglob("*") if file.is_file() and ".git/" not in str(file)}
    for name in [
        ".copier-answers.yml", "pyproject.toml", "zensical.toml", "AGENTS.md", "CITATION.cff",
        "README.md", "CONTRIBUTING.md", ".pre-commit-config.yaml", ".editorconfig", ".gitattributes",
        ".gitignore", ".python-version", ".github/dependabot.yml", ".github/codecov.yml",
        ".github/zizmor.yml", ".github/workflows/ci.yml", ".github/workflows/changelog.yml",
        ".github/workflows/docs.yml", ".github/workflows/release.yml",
        ".github/workflows/dependabot-automerge.yml", ".github/workflows/retry-jobs-without-runner.yml",
        "tests/test_docs.py", "docs/index.md", "docs/cli.md", "docs/changelog.md",
        f"docs/api/{answers['package']}.md",
    ]:  # fmt: skip
        assert name in files, name
    assert ("Dockerfile" in files) == answers["image"] == (".dockerignore" in files)
    assert not [name for name in files if "CLAUDE" in name]
    # The formats page under the name the answers give it, in the nav too.
    page = answers.get("formats_page", "formats.md")
    assert f"docs/{page}" in files
    assert f'"File formats" = "{page}"' in (path / "zensical.toml").read_text()
    # CITATION.cff dates the version the answers give, when they date it.
    if "released" in answers:
        assert f'date-released: "{answers["released"]}"' in (path / "CITATION.cff").read_text()
    for file in path.rglob("*"):
        if file.is_file() and ".git/" not in str(file) and file.name != ".copier-answers.yml":
            assert not re.search(r"\[=|=\]|\[%|%\]|\[#|#\]", file.read_text()), file


def actionlint(*args, cwd):
    """actionlint, as the lint job runs it: with the pinned shellcheck."""
    return uvx("--from", ACTIONLINT, "--with", SHELLCHECK, "actionlint", *args, cwd=cwd, check=False)


def test_actionlint_runs_shellcheck(tmp_path):
    """actionlint checks every script with shellcheck, which flags a
    variable a script sets and never uses (SC2034)."""
    probe = "on: push\npermissions: {}\njobs:\n  probe:\n    runs-on: ubuntu-latest\n"
    (tmp_path / "probe.yml").write_text(probe + "    steps:\n      - run: unused=1\n")
    result = actionlint("probe.yml", cwd=tmp_path)
    assert "SC2034" in result.stdout, result.stdout + result.stderr


def test_the_workflows_pass_actionlint(rendered):
    path, _ = rendered
    result = actionlint(cwd=path)
    assert result.returncode == 0, result.stdout + result.stderr


def test_the_workflows_pass_zizmor(rendered):
    path, _ = rendered
    result = uvx(ZIZMOR, "--offline", "--format", "plain", ".github/workflows", cwd=path, check=False)
    assert result.returncode == 0, result.stdout + result.stderr


def test_every_job_follows_the_conventions(rendered):
    """CONVENTIONS.md § 6: permissions at the top, a timeout on every job,
    pushes filtered to the default branch, no credentials left by checkout,
    no pull_request_target."""
    path, answers = rendered
    for workflow in (path / ".github" / "workflows").glob("*.yml"):
        content = yaml.safe_load(workflow.read_text())
        triggers = content[True]  # PyYAML reads `on` as True
        assert "permissions" in content, workflow.name
        assert "pull_request_target" not in triggers, workflow.name
        if isinstance(triggers, dict) and "push" in triggers and "branches" in (triggers["push"] or {}):
            assert triggers["push"]["branches"] == [answers["default_branch"]], workflow.name
        for name, job in content["jobs"].items():
            if "uses" not in job:
                assert "timeout-minutes" in job, f"{workflow.name}: {name}"
            for step in job.get("steps", []):
                if step.get("uses", "").startswith("actions/checkout@"):
                    assert step.get("with", {}).get("persist-credentials") is False, f"{workflow.name}: {name}"


def test_the_files_parse(rendered):
    path, answers = rendered
    pyproject = tomllib.loads((path / "pyproject.toml").read_text())
    project = pyproject["project"]
    assert project["name"] == answers["distribution"]
    assert project["scripts"] == {answers["command"]: answers["entry_point"]}
    assert ("version" in project) == (not answers["version_module"])
    assert project["license"] == answers["license"]
    assert pyproject["tool"]["ruff"]["line-length"] == answers["line_length"]
    assert pyproject["tool"]["bumpversion"]["current_version"] == answers["version"]
    zensical = tomllib.loads((path / "zensical.toml").read_text())
    options = zensical["project"]["plugins"]["mkdocstrings"]["handlers"]["python"]["options"]
    assert options["docstring_style"] == answers["docstring_style"]
    assert zensical["project"]["extra"]["release"] == answers["version"]
    for file in [*path.rglob("*.yml"), *path.rglob("*.yaml")]:
        if ".git/" not in str(file):
            yaml.safe_load(file.read_text())
    pre_commit = yaml.safe_load((path / ".pre-commit-config.yaml").read_text())
    ruff = [repo for repo in pre_commit["repos"] if "ruff-pre-commit" in repo["repo"]]
    assert ruff[0]["rev"] == f"v{answers['ruff_version']}"


def test_the_citation_validates(rendered):
    path, _ = rendered
    result = uvx(CFFCONVERT, "--validate", "-i", path / "CITATION.cff", check=False)
    assert result.returncode == 0, result.stdout + result.stderr


def test_the_docs_test_passes_ruff(rendered):
    """tests/test_docs.py is the repository's code: the repository's ruff,
    with the rendered configuration (its rules, its line length), passes it as
    written, from the repository, where its package is first-party."""
    path, answers = rendered
    # The package's module that the command runs, as the repository has it:
    # ruff resolves the whole module path to call it first-party.
    module = answers["entry_point"].split(":")[0].split(".")
    folder = path / ("src" if answers["src_layout"] else "")
    for depth in range(1, len(module)):
        (folder / Path(*module[:depth])).mkdir(parents=True, exist_ok=True)
        (folder / Path(*module[:depth]) / "__init__.py").touch()
    (folder / Path(*module[:-1]) / f"{module[-1]}.py").touch()
    lint = uvx(RUFF, "check", "--no-cache", "tests/test_docs.py", cwd=path, check=False)
    assert lint.returncode == 0, lint.stdout + lint.stderr
    form = uvx(RUFF, "format", "--no-cache", "--check", "--diff", "tests/test_docs.py", cwd=path, check=False)
    assert form.returncode == 0, form.stdout + form.stderr


def test_an_update_keeps_what_the_repository_owns(tmp_path):
    """Answering again (`copier update` does) leaves the files a repository
    owns once written, and rewrites the template's."""
    answers = FIXTURES / "answers" / "hicstuff.yml"
    dest = tmp_path / "repository"
    render(answers, dest)
    (dest / "README.md").write_text("# mine\n")
    (dest / "docs" / "cli.md").write_text("# mine\n")
    render(answers, dest, "--overwrite", "--data", "line_length=99")
    assert (dest / "README.md").read_text() == "# mine\n"
    assert (dest / "docs" / "cli.md").read_text() == "# mine\n"
    assert "line-length = 99" in (dest / "pyproject.toml").read_text()


# ---------------------------------------------------------------------------
# Applied to a sample package, as a repository applies it
# ---------------------------------------------------------------------------


def _locked_ruff(project):
    lock = (project / "uv.lock").read_text()
    return re.search(r'^name = "ruff"\nversion = "([^"]+)"', lock, re.M).group(1)


@pytest.fixture(scope="module", params=SAMPLES)
def sample(request, tmp_path_factory):
    """A sample package with the template applied, chromokit's kits added and
    its own dependencies locked: what a repository has once it has applied
    the template."""
    flavour = request.param
    project = tmp_path_factory.mktemp(f"sample-{flavour}") / "project"
    shutil.copytree(FIXTURES / "samples" / flavour, project, ignore=shutil.ignore_patterns("answers.yml"))
    answers_file = FIXTURES / "samples" / flavour / "answers.yml"
    answers = yaml.safe_load(answers_file.read_text())
    run("git", "init", "-q", "-b", answers["default_branch"], project)
    render(answers_file, project)
    chromokit = ["node", ROOT / "bin" / "chromokit.mjs"]
    repo = f"{answers['owner']}/{answers['repository']}"
    run(*chromokit, "init", "zensical", project, "--name", answers["project_name"], "--repo", repo, "--url", answers["docs_url"])
    run(*chromokit, "add", "report", project, "--package", answers["package"])
    # The repository's own: its dependencies, and its second command.
    if flavour == "scripts":
        pyproject = project / "pyproject.toml"
        text = pyproject.read_text()
        text = text.replace(
            'scriptkit = "scriptkit.cli:main"\n',
            'scriptkit = "scriptkit.cli:main"\nscriptkit-report = "scriptkit.cli:report"\n',
        )
        pyproject.write_text(text)
    run("uv", "add", "--quiet", *DEPENDENCIES[flavour], cwd=project)
    # pre-commit's ruff is the locked ruff: the lock takes the answer's.
    run("uv", "lock", "--quiet", "--upgrade-package", f"ruff=={answers['ruff_version']}", cwd=project)
    run("git", "add", "-A", cwd=project)
    return project, answers


def _steps(project, workflow, job):
    """The steps of a rendered job, by name."""
    content = yaml.safe_load((project / ".github" / "workflows" / workflow).read_text())
    return {step.get("name", step.get("uses")): step for step in content["jobs"][job]["steps"]}


def test_the_lock_and_the_environment(sample):
    project, _ = sample
    run("uv", "lock", "--check", cwd=project)
    run("uv", "sync", "--locked", "--quiet", cwd=project)


def test_the_tests_pass_and_test_docs_checks_the_reference(sample):
    """The package's tests, and the template's tests/test_docs.py, which reads
    the sample's own docs/cli.md."""
    project, answers = sample
    result = run("uv", "run", "--locked", "pytest", "-p", "no:cacheprovider", cwd=project, check=False)
    assert result.returncode == 0, result.stdout + result.stderr
    assert "test_docs.py" in result.stdout
    # A command the reference misses fails it.
    reference = project / "docs" / "cli.md"
    text = reference.read_text()
    first = re.search(r"^#{3,4} `[^`]+`.*$", text, re.M)
    reference.write_text(text.replace(first.group(0), "### `not-a-command`"))
    try:
        result = run("uv", "run", "--locked", "pytest", "-p", "no:cacheprovider", "--no-cov", "tests/test_docs.py", cwd=project, check=False)
    finally:
        reference.write_text(text)
    assert result.returncode != 0 and "not-a-command" in result.stdout


def test_test_docs_reads_sections_as_their_headings_nest(sample):
    """In the click sample's reference, a sub-section documents its command's
    options (`hello`'s --shout), two commands share a section (`fit fast` and
    `fit slow`), an example's comment is no heading, and a hidden alias
    (`fitting`) needs no section; an option documented in the sub-section of
    another command's section is not its own."""
    project, answers = sample
    if answers["cli"] != "click":
        pytest.skip("the click sample's reference")
    reference = project / "docs" / "cli.md"
    text = reference.read_text()
    row = "| `--shout/--no-shout` | off | In capitals. |\n"
    assert row in text and "#### `fit fast` and `fit slow`" in text
    moved = text.replace(row, "").replace("is hidden.\n", "is hidden.\n\n##### Shouting\n\n| Option |\n|---|\n" + row)
    reference.write_text(moved)
    try:
        result = run("uv", "run", "--locked", "pytest", "-p", "no:cacheprovider", "--no-cov", "tests/test_docs.py", cwd=project, check=False)
    finally:
        reference.write_text(text)
    assert result.returncode != 0
    assert "options of `hello` that docs/cli.md misses: ['--no-shout', '--shout']" in result.stdout
    assert "`data clean` --no-shout" in result.stdout


def test_ruff_and_ty_pass(sample):
    """The template's files and the package pass the template's ruff; the
    report kit is left out of ruff and ty."""
    project, answers = sample
    run("uv", "run", "--locked", "ruff", "check", ".", cwd=project)
    run("uv", "run", "--locked", "ruff", "format", "--check", ".", cwd=project)
    source = f"src/{answers['package']}" if answers["src_layout"] else answers["package"]
    assert (project / source / "_report" / "__init__.py").is_file()
    result = run("uv", "run", "--locked", "ty", "check", source.split("/")[0], cwd=project, check=False)
    assert result.returncode == 0, result.stdout + result.stderr


def test_the_lint_jobs_checks_pass(sample):
    """The lint job's check that pre-commit's ruff is the locked ruff
    (appendix B.1), run as the workflow writes it; and pre-commit itself."""
    project, _ = sample
    script = _steps(project, "ci.yml", "lint")["pre-commit's ruff is the ruff of uv.lock"]["run"]
    run("bash", "-e", "-c", script, cwd=project)
    result = run("uv", "run", "--locked", "pre-commit", "run", "--all-files", cwd=project, check=False)
    assert result.returncode == 0, result.stdout + result.stderr


def test_the_docs_build(sample):
    project, _ = sample
    result = run("uv", "run", "--locked", "--only-group", "docs", "zensical", "build", "--clean", "--strict", cwd=project, check=False)
    assert result.returncode == 0, result.stdout + result.stderr
    run("node", ROOT / "bin" / "chromokit.mjs", "check", project)


def test_bump_my_version_finds_every_version(sample):
    """A dry run of a release: every file the configuration names holds the
    version it searches for."""
    project, _ = sample
    result = run(
        "uv", "run", "--locked", "bump-my-version", "bump", "minor", "--dry-run", "--allow-dirty", "--no-commit", "--no-tag", "-v",
        cwd=project, check=False,
    )  # fmt: skip
    assert result.returncode == 0, result.stdout + result.stderr


def test_the_release_builds_and_checks(sample, tmp_path):
    """release.yml's checks on a version: the build, twine, the changelog's
    section (appendix B.2), the sdist's test data."""
    project, answers = sample
    dist = tmp_path / "dist"
    run("uv", "build", "--quiet", "--out-dir", dist, cwd=project)
    uvx(TWINE, "check", "--strict", *dist.glob("*.whl"), *dist.glob("*.tar.gz"))
    wheel = next(dist.glob("*.whl"))
    listing = run("python3", "-c", "import sys, zipfile; print('\\n'.join(zipfile.ZipFile(sys.argv[1]).namelist()))", wheel).stdout
    assert f"{answers['package']}/_report/base.html.j2" in listing
    sdist = next(dist.glob("*.tar.gz"))
    files = run("tar", "-tzf", sdist).stdout
    assert ("/tests/data/" in files) == answers["sdist_test_data"]
    # The changelog's section for a version, as release.yml extracts it.
    changelog = project / "docs" / "changelog.md"
    before = changelog.read_text()
    changelog.write_text(before.replace("## Unreleased\n", "## Unreleased\n\n## [9.9.9] - 2026-11-26\n\n### Added\n\n- A thing.\n"))
    try:
        script = _steps(project, "release.yml", "build")["The changelog's section for it"]["run"]
        run("bash", "-e", "-c", script, cwd=project, env={**os.environ, "VERSION": "9.9.9"})
        assert (project / "release-notes.md").read_text().strip() == "### Added\n\n- A thing."
        missing = run("bash", "-e", "-c", script, cwd=project, env={**os.environ, "VERSION": "9.9.8"}, check=False)
        assert missing.returncode == 1 and "has no entry for 9.9.8" in missing.stdout
    finally:
        changelog.write_text(before)
        (project / "release-notes.md").unlink(missing_ok=True)


def test_the_install_job(sample, tmp_path):
    """The install job's scripts, as the workflow writes them, on this
    machine: the wheel, installed from wheels in a fresh environment, every
    command's --help and the main one's --version (with nothing on PATH when
    nothing outside PyPI is needed), and the short real run."""
    project, answers = sample
    steps = _steps(project, "ci.yml", "install")
    python = tmp_path / "python"
    run("uv", "venv", "--quiet", "--seed", "--python", "3.13", python)
    env = {
        **os.environ,
        "PATH": f"{python / 'bin'}:{os.environ['PATH']}",
        "RUNNER_TEMP": str(tmp_path),
        "RUNNER_OS": "Linux",
        "PYTHON": "3.13",
    }
    for name in ["The wheel", "Installed from wheels, in a fresh environment"]:
        run("bash", "-e", "-c", steps[name]["run"], cwd=project, env=env)
    answers_step = next(name for name in steps if name.startswith("Every command answers --help"))
    result = run("bash", "-e", "-c", steps[answers_step]["run"], cwd=project, env=env)
    assert f"{answers['command']} --help" in result.stdout
    if answers["install_run"]:
        run("bash", "-e", "-c", steps["A short real run"]["run"], cwd=project, env=env)
    shutil.rmtree(project / "dist", ignore_errors=True)
