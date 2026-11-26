from click.testing import CliRunner

from scriptkit.cli import main, report


def test_main():
    assert CliRunner().invoke(main, ["-i", "x", "-t", "2"]).output == "x with 2\n"


def test_report():
    assert CliRunner().invoke(report, ["-o", "out"]).output == "report in out\n"


def test_version():
    assert "0.3.0" in CliRunner().invoke(main, ["--version"]).output
