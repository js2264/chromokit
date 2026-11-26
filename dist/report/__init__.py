# chromokit 0.2.0 - MIT - https://github.com/js2264/chromokit - the report kit: do not edit, chromokit sync replaces it and chromokit check refuses an edit
# Linted and formatted in chromokit, not by the package that holds it:
# ruff: noqa
# fmt: off
"""chromokit's report kit: the report of one run of a tool, for one sample.

A tool describes itself once, as a Tool: its name and version, the version of
its report's format (FORMAT_VERSION), its columns in MultiQC's General
Statistics table, and its page's template. It gathers a run into a Report:
sections, each a key and its value per line, and tables. write_report then
writes three files in an output directory, named after the sample
(report_files):

- <sample>.report.txt (write_txt): every number of the report, for scripts,
  which read_txt reads back;
- <sample>.report_mqc.yaml (write_mqc): MultiQC's custom content, the sample's
  row of its General Statistics table, which MultiQC merges with the other
  samples' rows;
- <sample>.report.html (write_html): a page to read the run with, rendered by
  Jinja2 from the tool's template, which extends this kit's base.html.j2. Its
  plots are drawn by plotly.js, which the page loads from its CDN at a pinned
  version (PLOTLY_JS); offline, it keeps its numbers and tables.

This is metaTOR's report (koszullab/metaTOR, src/metator/report.py),
generalised. It belongs to chromokit (https://github.com/js2264/chromokit):
`chromokit add report` and `chromokit sync` copy it into
src/<package>/_report/, and `chromokit check` refuses a local edit. It names no
package and imports nothing from the one that holds it, so one copy serves
every tool. Put a tool's own code in its own module, and its own page in its
own template.
"""

from __future__ import annotations

import math
import numbers
import os
import re
import sys
import time
from collections.abc import Mapping
from dataclasses import dataclass, field
from pathlib import Path

__all__ = [
    "PLOTLY_JS",
    "REPORT_FILES",
    "REPORT_HTML",
    "REPORT_MQC",
    "REPORT_TXT",
    "Report",
    "Tool",
    "format_value",
    "json_ready",
    "key_numbers",
    "read_txt",
    "report_files",
    "report_section",
    "sample_name",
    "write_html",
    "write_mqc",
    "write_report",
    "write_txt",
]

#: The files of a report, in the order report_files names them: the page
#: links to the other two.
REPORT_TXT = "report.txt"
REPORT_HTML = "report.html"
REPORT_MQC = "report_mqc.yaml"
REPORT_FILES = (REPORT_TXT, REPORT_HTML, REPORT_MQC)

#: plotly.js, which the page loads from its CDN when it is opened: a pinned
#: version, which draws the plots the same over time.
PLOTLY_JS = "https://cdn.plot.ly/plotly-2.35.2.min.js"

#: This kit's folder: its templates, its stylesheet and its script.
HERE = Path(__file__).resolve().parent

#: The name of a section or a table of report.txt, which read_txt finds again.
_NAME = re.compile(r"[a-z][a-z0-9_]*")

#: What the page's template reads: the context given to write_html must not
#: take these names.
_KIT_CONTEXT = frozenset(
    {
        "tool",
        "report",
        "sample",
        "tables",
        "columns",
        "figures",
        "links",
        "inputs",
        "key_numbers",
        "plotly_js",
        "format_version",
        "kit_css",
        "kit_js",
    }
)


def _numpy():
    """numpy, if the program has imported it: then a value may be one of its
    scalars. The kit itself needs no numpy."""
    return sys.modules.get("numpy")


@dataclass(frozen=True)
class Tool:
    """A tool, as its reports name it.

    Attributes
    ----------
    name : str
        The tool's name, as its pages and files write it: "metaTOR".
    version : str
        The tool's version, which writes the report.
    format_version : int
        The version of the format of report.txt and report_mqc.yaml: a key,
        a column, a unit or a MultiQC id that changes, or goes, raises it;
        one that comes does not.
    columns : tuple
        The tool's columns in MultiQC's General Statistics table, in order:
        for each, its key in report.txt, the section of that key, and how
        MultiQC shows it (its pconfig: title, description, format, min, max,
        suffix, scale). They are also the cards of the page's overview.
    id : str
        The MultiQC id of the tool's section: every sample's file carries it,
        and MultiQC merges the samples into one table. It also names the
        tool's version in the section report (<id>_version). By default, the
        name in lower case.
    description : str
        One line on what the columns sum up, which MultiQC shows; the format
        version follows it.
    docs : str
        Where report.txt is documented: its header links there.
    template : str or os.PathLike
        The tool's page: a Jinja2 template that starts with
        ``{% extends "_report/base.html.j2" %}``. Templates beside it can be
        included or imported by name. Without one, the page is the kit's
        base alone, which shows every section and table as it comes.
    """

    name: str
    version: str
    format_version: int
    columns: tuple = ()
    id: str | None = None
    description: str | None = None
    docs: str | None = None
    template: str | os.PathLike | None = None

    def __post_init__(self):
        if not self.name.strip():
            raise ValueError("a tool needs a name")
        ident = self.id
        if ident is None:
            ident = re.sub(r"[^a-z0-9]+", "_", self.name.lower()).strip("_")
        if not _NAME.fullmatch(ident):
            raise ValueError(f"{ident!r} cannot be a MultiQC id: [a-z][a-z0-9_]*")
        object.__setattr__(self, "id", ident)
        columns = tuple(tuple(column) for column in self.columns)
        for column in columns:
            if len(column) != 3 or not isinstance(column[2], Mapping):
                raise ValueError(f"a column is (key, section, pconfig), not {column!r}")
        object.__setattr__(self, "columns", columns)


@dataclass
class Report:
    """The report of one run, for one sample (see write_report).

    Attributes
    ----------
    sections : dict
        The sections of report.txt, by name, in order, each its keys and
        their values, in order (int, float, bool or str; None when missing).
        The first, report, says what wrote the report, for which sample, from
        what (see report_section). The page shows run (the run's parameters)
        and commands (its command lines, by step) in its Run section.
    tables : dict
        The tables of report.txt, by name, in order (pandas.DataFrame).
    plots : dict
        Whatever the tool draws its plots from: report.txt leaves it out.
    """

    sections: dict = field(default_factory=dict)
    tables: dict = field(default_factory=dict)
    plots: dict = field(default_factory=dict)

    @property
    def sample(self):
        """The sample's name, which names the report's files and its MultiQC row."""
        try:
            return self.sections["report"]["sample"]
        except KeyError:
            raise ValueError(
                "the report names no sample (see report_section)"
            ) from None


def report_files(name):
    """The files of the report of the sample name, in the order of
    REPORT_FILES: <name>.report.txt, <name>.report.html and
    <name>.report_mqc.yaml, which MultiQC finds by its _mqc suffix."""
    return tuple(f"{name}.{file}" for file in REPORT_FILES)


def sample_name(path, *extensions):
    """A sample's name from the name of its main file: the file's name without
    the longest of extensions that it ends with (metaTOR: the map's name
    without .metacool or .mmetacool)."""
    name = os.path.basename(os.fspath(path).rstrip("/\\"))
    for extension in sorted(extensions, key=len, reverse=True):
        if name.endswith(extension) and len(name) > len(extension):
            return name[: -len(extension)]
    return name


def report_section(tool, sample, inputs=None, **more):
    """The section report of a report, in order: format_version, sample, the
    run's inputs (a mapping, such as {"map": path}), the version of the tool
    that writes it (<tool.id>_version), when (written: now, in local time,
    to the second), then more."""
    section = {"format_version": tool.format_version, "sample": sample}
    section.update(inputs or {})
    section[f"{tool.id}_version"] = tool.version
    section["written"] = time.strftime("%Y-%m-%dT%H:%M:%S")
    section.update(more)
    return section


# ---------------------------------------------------------------------------
# report.txt
# ---------------------------------------------------------------------------


def _missing(value):
    """Whether value is missing: None, or a number that is not one (NaN)."""
    if value is None:
        return True
    if isinstance(value, numbers.Real) and not isinstance(value, numbers.Integral):
        return math.isnan(float(value))
    return False


def _is_bool(value):
    numpy = _numpy()
    return isinstance(value, bool) or (
        numpy is not None and isinstance(value, numpy.bool_)
    )


def format_value(key, value):
    """A value as report.txt writes it, under its key: NA for a missing one
    (None, NaN); true or false; an integer as an integer; a float with 2
    decimals for a percent (a key ending in _pct), 4 for a ratio or a
    fraction (_ratio, _fraction), as an integer when it is one and is
    neither, else as Python writes it shortest; a text on one line, NA when
    empty."""
    if _missing(value):
        return "NA"
    if _is_bool(value):
        return "true" if value else "false"
    if isinstance(value, numbers.Integral):
        return str(int(value))
    if isinstance(value, numbers.Real):
        value = float(value)
        if value.is_integer() and not key.endswith(("_pct", "_ratio", "_fraction")):
            return str(int(value))
        if key.endswith("_pct"):
            return f"{value:.2f}"
        if key.endswith(("_ratio", "_fraction")):
            return f"{value:.4f}"
        return repr(value)
    return " ".join(str(value).split()) or "NA"


def _check_name(kind, name):
    if not isinstance(name, str) or not _NAME.fullmatch(name):
        raise ValueError(
            f"{kind} {name!r}: report.txt names it in lowercase letters, digits and _, a letter first"
        )


def _check_word(kind, word, where):
    if not isinstance(word, str) or not word or word != "".join(word.split()):
        raise ValueError(
            f"{kind} {word!r} of {where}: report.txt splits its lines on spaces, so it holds none"
        )


def write_txt(report, path, tool):
    """Write report.txt at path: a header of comments, naming the tool, the
    sample and the format (tool.format_version), and linking tool.docs; each
    section, ``[name]``, then a line per key, the key, spaces, and its value
    (see format_value); each table, ``[table: name]``, then its header and a
    line per row, their fields aligned on spaces. No name, key, column or
    field holds a space: a field's spaces are written as _, and a section's
    value is the rest of its line. A missing value is NA."""
    sample = report.sample
    see = f" See {tool.docs}" if tool.docs else ""
    lines = [
        f"# {tool.name} report of {sample}",
        f"# format {tool.format_version}: [section] then a key and its value per line; [table: name] then a header and a row",
        f"# per line, on spaces; NA: missing.{see}",
        "",
    ]
    for name, values in report.sections.items():
        _check_name("section", name)
        for key in values:
            _check_word("key", key, f"section {name}")
        width = max((len(key) for key in values), default=0)
        lines.append(f"[{name}]")
        lines += [
            f"{key.ljust(width)}  {format_value(key, value)}"
            for key, value in values.items()
        ]
        lines.append("")
    for name, table in report.tables.items():
        _check_name("table", name)
        columns = [str(column) for column in table.columns]
        for column in columns:
            _check_word("column", column, f"table {name}")
        lines.append(f"[table: {name}]")
        rows = [
            [
                format_value(column, value).replace(" ", "_")
                for column, value in zip(columns, row, strict=True)
            ]
            for row in table.itertuples(index=False)
        ]
        widths = [
            max([len(column)] + [len(row[index]) for row in rows])
            for index, column in enumerate(columns)
        ]
        lines.append(
            "  ".join(
                column.ljust(width)
                for column, width in zip(columns, widths, strict=True)
            ).rstrip()
        )
        lines += [
            "  ".join(
                value.ljust(width) for value, width in zip(row, widths, strict=True)
            ).rstrip()
            for row in rows
        ]
        lines.append("")
    with open(path, "w", encoding="utf-8", newline="\n") as handle:
        handle.write("\n".join(lines))


def read_txt(path):
    """Read report.txt (see write_txt) back: its sections, by name, each its
    keys and their values, as text; and its tables, by name, as
    pandas.DataFrame of text. NA is None. What a script, or a MultiQC module,
    does to gather the reports of runs."""
    import pandas as pd

    sections, tables, current, header, rows = {}, {}, None, None, []

    def close():
        if header is not None:
            tables[current] = pd.DataFrame(rows, columns=pd.Index(header), dtype=object)

    with open(path, encoding="utf-8") as handle:
        for line in handle.read().splitlines():
            if not line.strip() or line.startswith("#"):
                continue
            match = re.fullmatch(r"\[(table: )?([a-z][a-z0-9_]*)\]", line.strip())
            if match:
                close()
                current, header, rows = match.group(2), None, []
                if match.group(1):
                    header = []
                else:
                    sections[current] = {}
                continue
            if header == []:
                header = line.split()
            elif header is not None:
                rows.append(
                    [None if value == "NA" else value for value in line.split()]
                )
            else:
                key, _, value = line.partition(" ")
                value = value.strip()
                sections[current][key] = None if value == "NA" else value
    close()
    return sections, tables


# ---------------------------------------------------------------------------
# report_mqc.yaml
# ---------------------------------------------------------------------------


def _column_value(report, key, section):
    """The value of a General Statistics column: None when missing."""
    value = report.sections.get(section, {}).get(key)
    if _missing(value):
        return None
    if _is_bool(value) or isinstance(value, numbers.Integral):
        return int(value)
    return float(value)


def write_mqc(report, path, tool):
    """Write report_mqc.yaml at path: MultiQC's custom content, the sample's
    row of its General Statistics table, of tool.columns (a missing value
    leaves its column out), under tool.id, which every sample's file
    carries, so that MultiQC merges the samples into one table (``multiqc
    .`` finds the files by their _mqc suffix)."""
    import yaml

    sample = report.sample
    row, pconfig = {}, []
    for key, section, config in tool.columns:
        value = _column_value(report, key, section)
        if value is None:
            continue
        row[key] = value
        pconfig.append({key: dict(config)})
    description = tool.description or f"{tool.name} runs"
    content = {
        "id": tool.id,
        "section_name": tool.name,
        "description": f"{description} (format {tool.format_version}).",
        "plot_type": "generalstats",
        "pconfig": pconfig,
        "data": {sample: row},
    }
    with open(path, "w", encoding="utf-8", newline="\n") as handle:
        handle.write(
            f"# {tool.name} report of {sample}: MultiQC custom content (General Statistics); multiqc finds it.\n"
        )
        yaml.safe_dump(
            content,
            handle,
            sort_keys=False,
            default_flow_style=False,
            allow_unicode=True,
        )


# ---------------------------------------------------------------------------
# report.html
# ---------------------------------------------------------------------------


def json_ready(value):
    """value with NaN and the infinities as None, tuples as lists, and numpy's
    types as Python's: what JSON.parse reads (it refuses NaN)."""
    numpy = _numpy()
    if isinstance(value, Mapping):
        return {str(key): json_ready(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_ready(item) for item in value]
    if numpy is not None and isinstance(value, numpy.ndarray):
        return json_ready(value.tolist())
    if _is_bool(value):
        return bool(value)
    if isinstance(value, numbers.Integral):
        return int(value)
    if isinstance(value, numbers.Real):
        return float(value) if math.isfinite(float(value)) else None
    return value


def key_numbers(report, tool):
    """The cards of the page's overview: the tool's General Statistics
    columns, each its title, its value as MultiQC formats it (with its
    suffix, NA when missing) and its description."""
    cards = []
    for key, section, config in tool.columns:
        value = _column_value(report, key, section)
        if value is None:
            shown = "NA"
        else:
            try:
                shown = config.get("format", "{:,}").format(value)
            except (ValueError, TypeError):
                shown = format_value(key, value)
            shown += config.get("suffix", "")
        cards.append(
            {
                "key": key,
                "section": section,
                "label": config.get("title", key),
                "value": shown,
                "detail": config.get("description", ""),
            }
        )
    return cards


def _environment(tool):
    import jinja2

    loaders = []
    if tool.template is not None:
        loaders.append(
            jinja2.FileSystemLoader(os.path.dirname(os.path.abspath(tool.template)))
        )
    loaders.append(jinja2.PrefixLoader({"_report": jinja2.FileSystemLoader(str(HERE))}))
    environment = jinja2.Environment(
        loader=jinja2.ChoiceLoader(loaders),
        autoescape=jinja2.select_autoescape(["html", "j2"]),
        trim_blocks=True,
        lstrip_blocks=True,
        undefined=jinja2.StrictUndefined,
    )
    environment.filters["value"] = lambda value, key="": format_value(key, value)
    return environment


def write_html(report, path, tool, *, figures=None, links=None, inputs=None, **context):
    """Write the page at path, from tool.template, which extends the kit's
    base.html.j2, or from the base alone.

    Parameters
    ----------
    figures : dict
        The plots, by the id of their place in the page: Plotly figures
        (data and layout), which plotly.js draws once the page has loaded it.
        A colour a figure leaves out follows the page's palette, light or
        dark.
    links : dict
        The run's outputs that the page links to, by whatever the tool's
        template reads; the page's Files section lists links["files"], paths
        relative to the page. By default, the report's other two files, when
        they are beside the page.
    inputs : dict
        What the run read, as the page's header names it: label, then value
        ({"Map": "out/sample.metacool"}).
    **context
        Anything else the tool's template reads.
    """
    clash = _KIT_CONTEXT & set(context)
    if clash:
        raise TypeError(
            f"write_html's context cannot set {', '.join(sorted(clash))}: the page's template reads them already"
        )
    from markupsafe import Markup

    if links is None:
        here = os.path.dirname(os.path.abspath(path))
        txt, _, mqc = report_files(report.sample)
        links = {
            "files": [
                name for name in (txt, mqc) if os.path.exists(os.path.join(here, name))
            ]
        }
    environment = _environment(tool)
    template = environment.get_template(
        os.path.basename(tool.template)
        if tool.template is not None
        else "_report/base.html.j2"
    )
    page = template.render(
        tool=tool,
        report=report.sections,
        sample=report.sample,
        tables={
            name: json_ready(table.to_dict(orient="records"))
            for name, table in report.tables.items()
        },
        columns={
            name: [str(column) for column in table.columns]
            for name, table in report.tables.items()
        },
        figures=json_ready(figures or {}),
        links=links,
        inputs=dict(inputs or {}),
        key_numbers=key_numbers(report, tool),
        plotly_js=PLOTLY_JS,
        format_version=tool.format_version,
        kit_css=Markup((HERE / "report.css").read_text(encoding="utf-8")),
        kit_js=Markup((HERE / "report.js").read_text(encoding="utf-8")),
        **context,
    )
    with open(path, "w", encoding="utf-8", newline="\n") as handle:
        handle.write(page)


def write_report(
    report, outdir, tool, *, figures=None, links=None, inputs=None, **context
):
    """Write the report of a run in outdir, named after its sample (see
    report_files): report.txt, report_mqc.yaml, then the page, which links to
    the other two (see write_html for figures, links, inputs and context).
    They replace files of their names; a symbolic link of their name is
    removed, never written through.

    Returns
    -------
    list of str
        Their paths, in the order of REPORT_FILES."""
    os.makedirs(outdir, exist_ok=True)
    paths = [os.path.join(outdir, name) for name in report_files(report.sample)]
    for path in paths:
        if os.path.islink(path):
            os.remove(path)
    txt, html, mqc = paths
    write_txt(report, txt, tool)
    write_mqc(report, mqc, tool)
    write_html(
        report, html, tool, figures=figures, links=links, inputs=inputs, **context
    )
    return paths
