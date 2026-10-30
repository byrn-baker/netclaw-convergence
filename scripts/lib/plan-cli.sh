#!/usr/bin/env bash
# Early, side-effect-free dispatch. Historical installer options bypass this.
netclaw_plan_dispatch() {
    local operation="" file=""
    case "${1:-}" in
        --emit-plan) operation=emit ;;
        --validate-plan) operation=validate ;;
        --explain-plan) operation=explain ;;
        --plan) operation=apply ;;
        *) return 1 ;;
    esac
    [ "$#" -eq 2 ] && [ -n "$2" ] || { echo 'This plan option requires exactly one file.' >&2; exit 2; }
    file="$2"
    if [ "$operation" = emit ]; then
        exec python3 "$SCRIPT_DIR/lib/setup_cli.py" "$file"
    fi
    exec python3 "$SCRIPT_DIR/setup-engine.py" "$operation" --plan "$file"
}
