from click.testing import CliRunner

from sampletool.cli import cli


def test_hello():
    result = CliRunner().invoke(cli, ["hello", "-n", "you", "--shout"])
    assert result.exit_code == 0
    assert result.output == "HELLO, YOU!\n"


def test_data():
    assert CliRunner().invoke(cli, ["data", "show", "-o", "x"]).output == "data\n"
    assert CliRunner().invoke(cli, ["data", "clean", "--legacy"]).output == "clean\n"


def test_version():
    assert "0.1.0" in CliRunner().invoke(cli, ["--version"]).output
