from doctool.cli import main


def test_commands(capsys):
    main(["detect", "-t", "2", "map.cool"])
    main(["quantify", "regions.bed", "map.cool", "out"])
    main(["list", "--long"])
    assert capsys.readouterr().out == "detect with 2\nquantify with 1\nlist with 1\n"
