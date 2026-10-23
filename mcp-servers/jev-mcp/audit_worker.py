"""GAIT subprocess worker: private local audit, no network, JSON on stdout only."""
import json
import os
import sys
from pathlib import Path


def main():
    from gait.repo import GaitRepo
    from gait.schema import Turn
    from gait.tokens import count_turn_tokens

    root = Path(os.environ.get("JEV_GAIT_ROOT", os.getcwd())).expanduser().resolve()
    root = next((candidate for candidate in (root, *root.parents) if (candidate / ".gait").is_dir()), None)
    if root is None:
        return 1
    record = json.load(sys.stdin)
    text = json.dumps(record, sort_keys=True)
    turn = Turn.v0(user_text="Jev advisory evaluation", assistant_text=text,
                   context={"source": "jev-mcp", "advisory_only": True}, tools={},
                   model={"provider": "typesafe-compatible", "model": record.get("model", "unknown")},
                   tokens=count_turn_tokens(user_text="Jev advisory evaluation", assistant_text=text), visibility="private")
    _, commit = GaitRepo(root=root).record_turn(turn, message="Jev advisory assessment " + record["assessment_id"])
    print(json.dumps({"commit": commit}))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        sys.exit(1)
