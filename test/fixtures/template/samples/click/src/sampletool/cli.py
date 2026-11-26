"""sampletool's command line: a group, a command, and a group of commands."""

import click

from sampletool import __version__

verbose = click.option("-v", "--verbose", is_flag=True, help="Debug logging.")


@click.group(context_settings={"help_option_names": ["-h", "--help"]})
@click.version_option(__version__)
def cli():
    """A sample tool."""


@cli.command()
@click.option("-n", "--name", default="world", help="Who to greet.")
@click.option("--shout/--no-shout", default=False, help="In capitals.")
@verbose
def hello(name, shout, verbose):
    """Greet someone."""
    text = f"Hello, {name}!"
    click.echo(text.upper() if shout else text)


@cli.group()
def data():
    """Commands on data."""


@data.command()
@click.option("-o", "--output", type=click.Path(), help="Where to write.")
@verbose
def show(output, verbose):
    """Show the data."""
    click.echo("data")


@data.command()
@click.option("--legacy", is_flag=True, hidden=True, help="A former name.")
@verbose
def clean(legacy, verbose):
    """Clean the data."""
    click.echo("clean")
