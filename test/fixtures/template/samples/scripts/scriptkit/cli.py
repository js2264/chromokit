"""scriptkit's two commands, each a console script."""

import click

from scriptkit import __version__

HELP = {"help_option_names": ["-h", "--help"]}


@click.command(context_settings=HELP)
@click.version_option(__version__)
@click.option("-i", "--input", "path", default="-", help="What to read.")
@click.option("-t", "--threads", default=1, type=int, help="Threads.")
def main(path, threads):
    """Read something."""
    click.echo(f"{path} with {threads}")


@click.command(context_settings=HELP)
@click.option("-o", "--outdir", default=".", help="Where to write the report.")
def report(outdir):
    """Write the report."""
    click.echo(f"report in {outdir}")
