"""Offline Genie adapter. One JSON request on stdin; one JSON response on stdout.

No testbed credentials, connections, or CLI execution are used. Parser diagnostics
are suppressed because they can contain sensitive input; failures use safe codes.
"""
import contextlib
import io
import json
import sys


def parse(request):
    try:
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            from genie.conf.base import Device
            from genie.metaparser.util.exceptions import SchemaEmptyParserError
            from importlib.metadata import version
    except ImportError:
        return {"error": "runtime_missing"}

    def offline_only(*args, **kwargs):
        raise RuntimeError("offline_only")

    try:
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            device = Device(name="captured-output", os=request["os"])
            device.execute = offline_only
            device.configure = offline_only
            device.connect = offline_only
            data = device.parse(request["command"], output=request["output"])
            parser_version = version("genie.libs.parser")
        if not isinstance(data, dict) or not data:
            return {"error": "empty_output"}
        return {"data": data, "parser": "Genie / pyATS", "version": parser_version}
    except SchemaEmptyParserError:
        return {"error": "empty_output"}
    except Exception as error:
        if "Could not find parser" in str(error) or isinstance(error, (ModuleNotFoundError, NotImplementedError)):
            return {"error": "unsupported_parser"}
        return {"error": "parse_failed"}


if __name__ == "__main__":
    try:
        result = parse(json.load(sys.stdin))
        print(json.dumps(result, allow_nan=False))
    except Exception:
        print(json.dumps({"error": "parse_failed"}))
