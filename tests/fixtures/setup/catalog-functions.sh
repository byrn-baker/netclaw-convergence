catalog_field() {
    # catalog_field <id> <n>   (2=category 3=name 4=description)
    local id="$1" n="$2" entry
    for entry in "${CATALOG[@]}"; do
        if [ "${entry%%|*}" = "$id" ]; then
            echo "$entry" | cut -d'|' -f"$n"
            return 0
        fi
    done
    return 1
}

catalog_ids() {
    local entry
    for entry in "${CATALOG[@]}"; do echo "${entry%%|*}"; done
}

catalog_has() {
    local id="$1" entry
    for entry in "${CATALOG[@]}"; do
        [ "${entry%%|*}" = "$id" ] && return 0
    done
    return 1
}
