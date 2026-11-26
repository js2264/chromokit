"""The report kit (dist/report), as a tool uses it.

Its sample is metaTOR's report of a run (test/fixtures/report/metator; see
sample.py): the kit writes report.txt and report_mqc.yaml byte for byte as
metaTOR's own writers did, read_txt reads report.txt back, the page holds the
run, and MultiQC merges two samples' rows, and two tools' rows of one sample,
into one General Statistics table.

    uv run --no-project --with pytest --with jinja2 --with pyyaml --with pandas pytest test/report

The tests that run MultiQC, ruff, ty or chromokit's command line skip when uvx
or node is missing.
"""

from __future__ import annotations

import csv
import dataclasses
import json
import math
import re
import shutil
import subprocess
import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sample as samples  # noqa: E402

ROOT = samples.ROOT
FIXTURE = samples.FIXTURE
MULTIQC = "multiqc==1.35"  # the version CONVENTIONS.md § 12 checks against
RUFF = "ruff==0.17.4"
TY = "ty==0.0.111"
#: The conventions' lint rules (CONVENTIONS.md § 5).
RULES = ["--select", "E,W,F,I,B,UP,SIM,RUF", "--ignore", "E501"]

needs_uvx = pytest.mark.skipif(shutil.which("uvx") is None, reason="needs uvx")
needs_node = pytest.mark.skipif(shutil.which("node") is None, reason="needs node")


@pytest.fixture(scope="session")
def kit():
    return samples.load_kit()


@pytest.fixture
def metator(kit):
    return samples.metator(kit)


@pytest.fixture
def written(kit, metator, tmp_path):
    report, tool, extra = metator
    samples.outputs(extra["links"], tmp_path)
    paths = kit.write_report(report, tmp_path, tool, **extra)
    return [Path(path) for path in paths]


# ---------------------------------------------------------------------------
# report.txt and report_mqc.yaml: metaTOR's, byte for byte
# ---------------------------------------------------------------------------


def test_report_txt_is_metators(written):
    """metaTOR's writer and the kit's give the same bytes for the same run."""
    txt, _, _ = written
    assert txt.read_bytes() == (FIXTURE / "sample.report.txt").read_bytes()


def test_report_mqc_is_metators(written):
    _, _, mqc = written
    assert mqc.read_bytes() == (FIXTURE / "sample.report_mqc.yaml").read_bytes()


def test_read_txt_reads_back_what_write_txt_wrote(kit, metator, written):
    """Every key of every section, and every field of every table, as text;
    NA as None."""
    report, _, _ = metator
    sections, tables = kit.read_txt(written[0])
    assert list(sections) == list(report.sections)
    for name, values in report.sections.items():
        assert list(sections[name]) == list(values), name
        for key, value in values.items():
            text = kit.format_value(key, value)
            assert sections[name][key] == (None if text == "NA" else text), (name, key)
    assert list(tables) == list(report.tables)
    for name, table in report.tables.items():
        assert list(tables[name].columns) == list(table.columns), name
        expected = [
            [kit.format_value(column, value).replace(" ", "_") for column, value in zip(table.columns, row)]
            for row in table.itertuples(index=False)
        ]
        read = [[("NA" if value is None else value) for value in row] for row in tables[name].itertuples(index=False)]
        assert read == expected, name


def test_report_files_and_order(kit, written, metator):
    report, _, _ = metator
    assert kit.report_files("S1") == ("S1.report.txt", "S1.report.html", "S1.report_mqc.yaml")
    assert [path.name for path in written] == list(kit.report_files(report.sample))
    assert all(path.is_file() for path in written)


def test_write_report_replaces_a_link_rather_than_writing_through_it(kit, metator, tmp_path):
    report, tool, extra = metator
    elsewhere = tmp_path / "elsewhere.txt"
    elsewhere.write_text("mine\n")
    out = tmp_path / "out"
    out.mkdir()
    (out / "sample.report.txt").symlink_to(elsewhere)
    kit.write_report(report, out, tool, **extra)
    assert elsewhere.read_text() == "mine\n"
    assert not (out / "sample.report.txt").is_symlink()


# ---------------------------------------------------------------------------
# The page
# ---------------------------------------------------------------------------


def _figures(page):
    (figures,) = re.findall(r'<script id="cx-report-figures" type="application/json">(.*?)</script>', page, re.S)
    return json.loads(figures, parse_constant=lambda name: pytest.fail(f"{name} in the figures"))


def test_the_page_holds_the_run(kit, metator, written):
    report, tool, extra = metator
    page = written[1].read_text(encoding="utf-8")
    assert "{{" not in page and "{%" not in page and "[[icon:" not in page
    assert f'<script src="{kit.PLOTLY_JS}" charset="utf-8" defer></script>' in page
    assert kit.PLOTLY_JS == "https://cdn.plot.ly/plotly-2.35.2.min.js"
    # The kit's stylesheet and script, inline: the page is one file.
    assert "--cx-accent" in page and "__chromokitReport" in page
    # Every plot's place has its figure, and every figure a place.
    figures = _figures(page)
    places = re.findall(r'class="cx-report__plot" id="([a-z0-9-]+)" data-figure', page)
    assert sorted(places) == sorted(figures) == sorted(extra["figures"])
    # The header: the tool, its version, the sample, the inputs, the date.
    assert f"<title>metaTOR report · {report.sample}</title>" in page
    assert f"v{tool.version}" in page and report.sections["report"]["written"].replace("T", " ") in page
    for value in extra["inputs"].values():
        assert f"<code>{value}</code>" in page
    # The bar's links lead to sections of the page, Overview first, Run and Files last.
    targets = re.findall(r'<nav class="cx-report__nav".*?</nav>', page, re.S)[0]
    anchors = re.findall(r'href="#([a-z0-9-]+)"', targets)
    assert anchors[0] == "overview" and anchors[-2:] == ["run", "files"]
    for anchor in anchors:
        assert f'id="{anchor}"' in page, anchor
    # A row per MAG, sortable and filterable, each with its links.
    mags = report.tables["mags"]
    for name in mags["name"]:
        assert f"<td>{name}</td>" in page
    assert 'id="table-mags" data-sortable' in page and 'data-table="table-mags"' in page
    # The footer: the tool's version and the report's format.
    assert f"Written by metaTOR {tool.version} · report format {tool.format_version}" in page


def test_every_link_of_the_page_leads_somewhere(written):
    page = written[1].read_text(encoding="utf-8")
    for link in re.findall(r'href="([^"#][^"]*)"', page):
        assert link.startswith("https://") or (written[1].parent / link).exists(), link


def test_the_page_alone_lists_the_reports_other_files(kit, metator, tmp_path):
    """Without links, the Files section lists report.txt and report_mqc.yaml,
    which write_report writes before the page."""
    report, tool, extra = metator
    kit.write_report(report, tmp_path, dataclasses.replace(tool, template=None), figures=extra["figures"])
    files = (tmp_path / "sample.report.html").read_text().split('<section id="files"')[1]
    assert 'href="sample.report.txt"' in files and 'href="sample.report_mqc.yaml"' in files


def test_the_base_alone_shows_every_section_and_table(kit, metator, tmp_path):
    """A tool without a template of its own gets every section as facts, every
    table sortable, its General Statistics columns as the overview's cards."""
    report, tool, extra = metator
    tool = dataclasses.replace(tool, template=None)
    path = tmp_path / "page.html"
    kit.write_html(report, path, tool, figures=extra["figures"], inputs=extra["inputs"])
    page = path.read_text()
    for name in report.sections:
        assert (f'id="section-{name}"' in page) == (name not in ("report", "run", "commands")), name
    for name, table in report.tables.items():
        assert f'id="table-{name}" data-sortable' in page
    for card in kit.key_numbers(report, tool):
        assert card["label"] in page and card["value"] in page
    assert "578,000 bp" in page  # MultiQC's format, and its suffix
    assert sorted(re.findall(r'id="(plot-[a-z]+)" data-figure', page)) == sorted(extra["figures"])


def test_the_page_escapes_what_it_writes(kit, metator, tmp_path):
    report, tool, extra = metator
    report.sections["run"]["assembly"] = "<script>alert(1)</script>"
    path = tmp_path / "page.html"
    kit.write_html(report, path, dataclasses.replace(tool, template=None))
    page = path.read_text()
    assert "<script>alert(1)</script>" not in page and "&lt;script&gt;alert(1)&lt;/script&gt;" in page


def test_the_inline_stylesheet_and_script_cannot_close_their_tags():
    css = (ROOT / "dist" / "report" / "report.css").read_text()
    js = (ROOT / "dist" / "report" / "report.js").read_text()
    assert "</style" not in css.lower() and "</script" not in js.lower()


def test_the_context_cannot_take_the_kits_names(kit, metator, tmp_path):
    report, tool, _ = metator
    with pytest.raises(TypeError, match="report"):
        kit.write_html(report, tmp_path / "page.html", tool, report={})


# ---------------------------------------------------------------------------
# The values, the names, the tool
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("key", "value", "text"),
    [
        ("contigs", None, "NA"),
        ("contigs", math.nan, "NA"),
        ("contigs", 12, "12"),
        ("contigs", 12.0, "12"),
        ("length_bp", 1234.5, "1234.5"),
        ("in_mags_pct", 96.88581314878893, "96.89"),
        ("in_mags_pct", 12, "12"),
        ("trans_contig_ratio", 0.526217, "0.5262"),
        ("intra_genome_fraction", 1.0, "1.0000"),
        ("markers_predate_genomes", True, "true"),
        ("markers_predate_genomes", False, "false"),
        ("command", "metator  pipeline\n -a  x", "metator pipeline -a x"),
        ("input", "", "NA"),
        ("res_param", 0.1, "0.1"),
    ],
)
def test_format_value(kit, key, value, text):
    assert kit.format_value(key, value) == text


def test_numpy_values(kit):
    np = pytest.importorskip("numpy")
    assert kit.format_value("contigs", np.int64(5)) == "5"
    assert kit.format_value("gc_pct", np.float32(49.5)) == "49.50"
    assert kit.format_value("gc_pct", np.float64("nan")) == "NA"
    assert kit.format_value("flag", np.bool_(True)) == "true"
    assert kit.json_ready({"a": np.array([1.0, np.inf]), "b": (np.int32(2), np.bool_(False))}) == {"a": [1.0, None], "b": [2, False]}


def test_the_report_section(kit):
    tool = kit.Tool(name="metaTOR", version="1.4.0", format_version=1)
    section = kit.report_section(tool, "S1", {"map": "out/S1.metacool"}, map_written="2026-11-26")
    assert list(section) == ["format_version", "sample", "map", "metator_version", "written", "map_written"]
    assert re.fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d", section["written"])


def test_the_sample_name(kit):
    assert kit.sample_name("out/S1.metacool", ".metacool", ".mmetacool") == "S1"
    assert kit.sample_name("out/S1.mmetacool", ".metacool", ".mmetacool") == "S1"
    assert kit.sample_name("runs/S2/", ".metacool") == "S2"
    assert kit.sample_name(".metacool", ".metacool") == ".metacool"


def test_the_tool(kit):
    assert kit.Tool(name="metaTOR", version="1", format_version=1).id == "metator"
    assert kit.Tool(name="tinyMapper", version="1", format_version=1).id == "tinymapper"
    with pytest.raises(ValueError, match="MultiQC id"):
        kit.Tool(name="x", version="1", format_version=1, id="Not an id")
    with pytest.raises(ValueError, match="pconfig"):
        kit.Tool(name="x", version="1", format_version=1, columns=[("key", "section")])
    with pytest.raises(ValueError, match="needs a name"):
        kit.Tool(name=" ", version="1", format_version=1)


@pytest.mark.parametrize(
    ("sections", "tables", "message"),
    [
        ({"Run": {"a": 1}}, {}, "section 'Run'"),
        ({"run": {"a key": 1}}, {}, "key 'a key'"),
        ({}, {"my table": pd.DataFrame({"a": [1]})}, "table 'my table'"),
        ({}, {"rows": pd.DataFrame({"a column": [1]})}, "column 'a column'"),
    ],
)
def test_names_that_read_txt_could_not_read_back(kit, tmp_path, sections, tables, message):
    tool = kit.Tool(name="x", version="1", format_version=1)
    report = kit.Report(sections={"report": kit.report_section(tool, "S1"), **sections}, tables=tables)
    with pytest.raises(ValueError, match=message):
        kit.write_txt(report, tmp_path / "report.txt", tool)


def test_a_report_without_a_sample(kit, tmp_path):
    with pytest.raises(ValueError, match="names no sample"):
        kit.write_txt(kit.Report(), tmp_path / "report.txt", kit.Tool(name="x", version="1", format_version=1))


def test_a_missing_column_leaves_the_row(kit, tmp_path):
    yaml = pytest.importorskip("yaml")
    tool = kit.Tool(
        name="x",
        version="1",
        format_version=2,
        columns=[("n", "counts", {"title": "N"}), ("absent", "counts", {"title": "A"}), ("ratio", "counts", {"title": "R"})],
        description="x runs",
    )
    report = kit.Report(sections={"report": kit.report_section(tool, "S1"), "counts": {"n": 3, "absent": None, "ratio": 0.5}})
    kit.write_mqc(report, tmp_path / "S1.report_mqc.yaml", tool)
    content = yaml.safe_load((tmp_path / "S1.report_mqc.yaml").read_text())
    assert content["data"] == {"S1": {"n": 3, "ratio": 0.5}}
    assert [next(iter(column)) for column in content["pconfig"]] == ["n", "ratio"]
    assert content["description"] == "x runs (format 2)." and content["id"] == "x"


# ---------------------------------------------------------------------------
# MultiQC: one table, a row per sample, a column per tool's number
# ---------------------------------------------------------------------------


@needs_uvx
def test_multiqc_merges_the_samples_and_the_tools(kit, tmp_path):
    """Two samples' report_mqc.yaml give two rows of one General Statistics
    table; a second tool's file for one of them adds its columns to that
    sample's row (CONVENTIONS.md § 12: one name for one sample)."""
    runs = tmp_path / "runs"
    runs.mkdir()
    for name, length in (("S1", 578000), ("S2", 600000)):
        report, tool, _ = samples.metator(kit, name)
        report.sections["contigs"]["contigs_bp"] = length
        kit.write_mqc(report, runs / f"{name}.report_mqc.yaml", tool)
    other = kit.Tool(
        name="hicstuff",
        version="4.1.0",
        format_version=1,
        columns=[
            ("pairs", "pairs", {"title": "Pairs", "format": "{:,.0f}"}),
            ("trans_ratio", "contacts", {"title": "Trans ratio", "min": 0, "max": 1, "format": "{:,.3f}"}),
        ],
    )
    report = kit.Report(
        sections={"report": kit.report_section(other, "S1"), "pairs": {"pairs": 1_000_000}, "contacts": {"trans_ratio": 0.25}}
    )
    (runs / "hicstuff").mkdir()
    kit.write_mqc(report, runs / "hicstuff" / "S1.report_mqc.yaml", other)

    out = tmp_path / "multiqc"
    result = subprocess.run(
        ["uvx", "--quiet", "--from", MULTIQC, "multiqc", str(runs), "--outdir", str(out), "--force", "--no-ansi"],
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    with open(out / "multiqc_data" / "multiqc_general_stats.txt", newline="") as handle:
        rows = {row["Sample"]: row for row in csv.DictReader(handle, delimiter="\t")}
    assert sorted(rows) == ["S1", "S2"]
    metator_columns = [f"custom_content_metator-{key}" for key, _, _ in samples.metator(kit)[1].columns]
    for name, length in (("S1", "578000"), ("S2", "600000")):
        assert all(column in rows[name] for column in metator_columns)
        assert rows[name]["custom_content_metator-contigs_bp"] == length
    assert rows["S1"]["custom_content_hicstuff-pairs"] == "1000000"
    assert rows["S1"]["custom_content_hicstuff-trans_ratio"] == "0.25"
    assert rows["S2"]["custom_content_hicstuff-pairs"] == ""


# ---------------------------------------------------------------------------
# In a package: placed by chromokit, imported relatively, linted as chromokit's
# ---------------------------------------------------------------------------


@pytest.fixture(scope="session")
def package(tmp_path_factory):
    """A Python package with the kit, as `chromokit add report` places it."""
    if shutil.which("node") is None:
        pytest.skip("needs node")
    root = tmp_path_factory.mktemp("project")
    (root / "pyproject.toml").write_text('[project]\nname = "toolkit-sample"\nversion = "0.1.0"\n')
    (root / "src" / "toolkit_sample").mkdir(parents=True)
    (root / "src" / "toolkit_sample" / "__init__.py").write_text('"""A tool."""\n')
    subprocess.run(["node", str(ROOT / "bin" / "chromokit.mjs"), "add", "report", str(root)], check=True, capture_output=True)
    return root


def test_the_kit_in_a_package(package, tmp_path):
    """Imported from the package that holds it, the kit writes the same report:
    it names no package and imports none."""
    kit_dir = package / "src" / "toolkit_sample" / "_report"
    assert sorted(path.name for path in kit_dir.iterdir()) == sorted(path.name for path in (ROOT / "dist" / "report").iterdir())
    code = (
        "import sys; sys.dont_write_bytecode = True; sys.path.insert(0, sys.argv[1]); sys.path.insert(0, sys.argv[2])\n"
        "import toolkit_sample._report as kit, sample\n"
        "report, tool, extra = sample.metator(kit)\n"
        "print(kit.write_report(report, sys.argv[3], tool, **extra))\n"
    )
    subprocess.run(
        [sys.executable, "-c", code, str(package / "src"), str(Path(__file__).parent), str(tmp_path)], check=True
    )
    assert (tmp_path / "sample.report.txt").read_bytes() == (FIXTURE / "sample.report.txt").read_bytes()
    imports = set(re.findall(r"^\s*(?:from|import) ([\w.]+)", (kit_dir / "__init__.py").read_text(), re.M))
    assert imports <= {"__future__", "math", "numbers", "os", "re", "sys", "time", "collections.abc", "dataclasses",
                       "pathlib", "jinja2", "markupsafe", "yaml", "pandas"}, imports  # fmt: skip


def _uvx(*args, cwd=None):
    return subprocess.run(["uvx", "--quiet", *args], capture_output=True, text=True, cwd=cwd, check=False)


@needs_uvx
def test_the_source_follows_the_conventions():
    """chromokit lints and formats the kit's Python as the conventions say,
    since the package that holds it does neither."""
    source = str(ROOT / "adapters" / "report" / "__init__.py")
    lint = _uvx(RUFF, "check", "--no-cache", *RULES, "--target-version", "py310", source)
    assert lint.returncode == 0, lint.stdout + lint.stderr
    form = _uvx(RUFF, "format", "--no-cache", "--check", "--line-length", "88", "--target-version", "py310", source)
    assert form.returncode == 0, form.stdout + form.stderr


@needs_uvx
@pytest.mark.parametrize("line_length", ["88", "100", "130"])
def test_a_package_leaves_the_kit_as_it_is(package, line_length):
    """Whatever its line length, the package's ruff passes the kit's files,
    E501 included, and leaves them as they are."""
    kit_dir = str(package / "src" / "toolkit_sample" / "_report")
    lint = _uvx(RUFF, "check", "--no-cache", "--select", "E,W,F,I,B,UP,SIM,RUF", "--line-length", line_length, kit_dir)
    assert lint.returncode == 0, lint.stdout + lint.stderr
    form = _uvx(RUFF, "format", "--no-cache", "--check", "--line-length", line_length, kit_dir)
    assert form.returncode == 0, form.stdout + form.stderr


@needs_uvx
def test_ty_finds_nothing_in_the_kit(package, tmp_path):
    """ty, in an environment that has what the kit imports, as a package's has."""
    venv = tmp_path / "venv"
    subprocess.run(["uv", "venv", "--quiet", str(venv)], check=True)
    python = venv / "bin" / "python"
    subprocess.run(["uv", "pip", "install", "--quiet", "--python", str(python), "jinja2", "pyyaml", "pandas"], check=True)
    result = _uvx(TY, "check", "--python", str(python), "src", cwd=package)
    assert result.returncode == 0, result.stdout + result.stderr


def test_no_bytecode_in_dist(kit):
    """Importing the kit from dist/ leaves no __pycache__ there, which the
    build would call stale."""
    assert not any(path.suffix == ".pyc" for path in (ROOT / "dist").rglob("*"))
