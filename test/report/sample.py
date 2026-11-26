"""The report kit's sample: metaTOR's report of a run, written by the kit.

    python test/report/sample.py OUTDIR [--sample NAME] [--outputs]

The run is test/fixtures/report/metator/report.json: what metaTOR's own code
(metator.report.collect and figures, koszullab/metaTOR af54142) gathered from
tests/test_report.py's run, its paths made relative and its dates fixed. The
page is metaTOR's template ported to the kit (report.html.j2 beside it).
--outputs writes empty files where the page links to the run's outputs, so
that every link of the page leads somewhere (site.yml checks them).

The tests (test_report.py) and site.yml, which puts the page under
examples/report/ and takes its screenshots, use it.
"""

from __future__ import annotations

import argparse
import copy
import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FIXTURE = ROOT / "test" / "fixtures" / "report" / "metator"
DOCS = "https://koszullab.github.io/metator/formats/#the-report-of-a-run"
DESCRIPTION = "metaTOR runs: the MAGs of the map of each run, and its MGE clusters"


def load_kit(path=ROOT / "dist" / "report", name="chromokit_report"):
    """The kit at path, imported as a package of its own: it imports nothing
    from the package that holds it."""
    if name in sys.modules:
        return sys.modules[name]
    # No __pycache__ in dist/: the build would call it stale.
    sys.dont_write_bytecode = True
    spec = importlib.util.spec_from_file_location(
        name, Path(path) / "__init__.py", submodule_search_locations=[str(path)]
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def metator(kit, sample=None):
    """metaTOR's report of the fixture's run: the Report, the Tool, and what
    write_report takes besides (figures, links, inputs, context). sample
    renames the run, as another sample's report."""
    import pandas as pd

    data = json.loads((FIXTURE / "report.json").read_text(encoding="utf-8"))
    sections = copy.deepcopy(data["sections"])
    if sample is not None:
        sections["report"]["sample"] = sample
    report = kit.Report(
        sections=sections,
        tables={
            name: pd.DataFrame(table["rows"], columns=table["columns"])
            for name, table in data["tables"].items()
        },
    )
    tool = kit.Tool(
        name="metaTOR",
        version=data["version"],
        format_version=data["format_version"],
        columns=data["columns"],
        description=DESCRIPTION,
        docs=DOCS,
        template=FIXTURE / "report.html.j2",
    )
    inputs = {"Map": sections["report"]["map"]}
    if sections["run"].get("assembly"):
        inputs["Assembly"] = sections["run"]["assembly"]
    extra = {
        "figures": data["figures"],
        "links": data["links"],
        "inputs": inputs,
        "qualities": data["context"]["qualities"],
        "colours": data["context"]["colours"],
    }
    return report, tool, extra


def outputs(links, outdir):
    """Empty files where the page links to the run's outputs."""
    paths = [*links["files"]]
    for mag in links["mags"].values():
        paths += [path for path in mag.values() if path]
    for path in paths:
        target = Path(outdir) / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.touch()


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("outdir")
    parser.add_argument("--sample", default=None)
    parser.add_argument("--outputs", action="store_true")
    args = parser.parse_args(argv)
    kit = load_kit()
    report, tool, extra = metator(kit, args.sample)
    if args.outputs:
        outputs(extra["links"], args.outdir)
    for path in kit.write_report(report, args.outdir, tool, **extra):
        print(path)


if __name__ == "__main__":
    main()
