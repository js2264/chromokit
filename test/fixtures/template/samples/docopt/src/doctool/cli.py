"""doctool: a sample command line, read by docopt.

Usage:
    doctool detect [--threads=N] [--pattern=NAME] [--no-plotting]
                   <map> [<prefix>]
    doctool quantify [--threads=N] [--win-size=SIZE] <bed> <map> <prefix>
    doctool list [options]
    doctool --version
    doctool -h | --help

Options:
    -t, --threads=N     How many threads [default: 1].
    --pattern=NAME      The pattern to look for [default: loops].
    --no-plotting       No plots.
    --win-size=SIZE     The window's size [default: auto].
    --long              Every detail.
    -h, --help          This help.
    --version           The version.
"""

from docopt import docopt

from doctool import __version__


def main(argv=None):
    """Run the command that argv names."""
    args = docopt(__doc__, argv=argv, version=__version__)
    for command in ("detect", "quantify", "list"):
        if args[command]:
            print(f"{command} with {args['--threads']}")
