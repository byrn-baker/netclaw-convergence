#!/usr/bin/env bash
# Daily upstream sync for this fork (see docs/runbooks/upstream-sync.md).
#
# Keeps one pull request, branch $SYNC_BRANCH -> $BASE_BRANCH, that brings
# automateyournetwork/netclaw main into the fork:
#   - clean merge: the branch is the merge commit, with fast offline checks in the PR;
#   - conflicts:   the branch is upstream's main itself, so GitHub shows the conflicts;
#                  the PR lists the files to resolve locally;
#   - a person pushed resolution commits to the branch: never reset it; merge new
#     upstream commits on top when clean, otherwise comment on the PR.
# Nothing is merged into $BASE_BRANCH; that stays a reviewed decision.
#
# Environment: GH_TOKEN (gh CLI), GITHUB_REPOSITORY. DRY_RUN=1 prints the outcome and
# pushes nothing.
set -euo pipefail

UPSTREAM_URL=${UPSTREAM_URL:-https://github.com/automateyournetwork/netclaw.git}
BASE=${BASE_BRANCH:-main}
BRANCH=${SYNC_BRANCH:-sync/upstream}
REPO=${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}
DRY_RUN=${DRY_RUN:-0}
BOT_NAME="netclaw-upstream-sync"
BOT_EMAIL="41898282+github-actions[bot]@users.noreply.github.com"
OUT=$(mktemp -d)

git config user.name "$BOT_NAME"
git config user.email "$BOT_EMAIL"
git remote get-url upstream >/dev/null 2>&1 || git remote add upstream "$UPSTREAM_URL"
git fetch --quiet --no-tags upstream main
git fetch --quiet --no-tags origin "$BASE"
has_branch=0
if git ls-remote --exit-code --heads origin "$BRANCH" >/dev/null 2>&1; then
  git fetch --quiet --no-tags origin "$BRANCH:refs/remotes/origin/$BRANCH"
  has_branch=1
fi

up=$(git rev-parse upstream/main)
up_short=$(git rev-parse --short upstream/main)
up_version=$(git show upstream/main:VERSION 2>/dev/null | tr -d '[:space:]' || true)
behind=$(git rev-list --count "origin/$BASE..upstream/main")

pr=""
if [ "$DRY_RUN" != 1 ]; then
  pr=$(gh pr list -R "$REPO" --head "$BRANCH" --base "$BASE" --state open --json number -q '.[0].number // empty')
fi

say() { echo "upstream-sync: $*"; }

if [ "$behind" -eq 0 ]; then
  say "$BASE already contains upstream $up_short"
  if [ -n "$pr" ]; then
    gh pr close "$pr" -R "$REPO" --comment "Upstream $up_short is already in \`$BASE\`; closing." --delete-branch
  fi
  exit 0
fi

# Commits on the sync branch written by someone other than this job are
# conflict-resolution work. They are never discarded.
human=0
if [ "$has_branch" = 1 ]; then
  human=$(git log --format='%ae' "origin/$BRANCH" --not "origin/$BASE" upstream/main | grep -vcx "$BOT_EMAIL" || true)
fi

commit_list() {  # newest upstream commits not yet in the base, first-parent view
  git log --first-parent -n 40 --format='- `%h` %s' "origin/$BASE..upstream/main"
  local more=$(( $(git rev-list --first-parent --count "origin/$BASE..upstream/main") - 40 ))
  [ "$more" -gt 0 ] && echo "- … and $more more"
  return 0
}

run_checks() {  # fast, offline, standard-library checks; writes a markdown table
  local table="$OUT/checks.md" failed=0
  printf '| Check | Result |\n|---|---|\n' > "$table"
  check() {
    local name=$1; shift
    if (umask 077; "$@") > "$OUT/check.log" 2>&1; then
      printf '| %s | PASS |\n' "$name" >> "$table"
    else
      failed=1
      printf '| %s | **FAIL**: `%s` |\n' "$name" "$(tail -n 1 "$OUT/check.log" | tr '|`' "/'" | cut -c1-160)" >> "$table"
    fi
  }
  check "No conflict markers" bash -c '! git grep -qE "^(<<<<<<< |>>>>>>> )" -- .'
  check "Catalog generation parity" python3 scripts/build-catalog.py --check
  check "Catalog metadata" python3 scripts/check-catalog-metadata.py
  check "Catalog coverage" python3 scripts/verify-catalog-coverage.py
  check "Inventory counts" python3 scripts/verify-inventory-counts.py
  check "Spec artifacts" python3 scripts/verify-spec-artifacts.py
  check "Installer effects manifest" python3 -c 'import os,sys; sys.path.insert(0,"scripts/lib"); from setup_deploy import EffectAudit; EffectAudit(os.getcwd()).verify()'
  check "MCP reconciliation" python3 scripts/reconcile-mcp.py --surface catalog --surface dependencies --surface docs --surface meraki-ids --surface packages --surface portability
  return $failed
}

push_branch() {  # $1 = ref to publish, $2 = force|plain
  if [ "$DRY_RUN" = 1 ]; then say "dry run: would push $1 to $BRANCH ($2)"; return 0; fi
  local args=(--quiet origin "$1:refs/heads/$BRANCH")
  [ "$2" = force ] && args=(--quiet --force-with-lease="$BRANCH" origin "$1:refs/heads/$BRANCH")
  if ! git push "${args[@]}" 2> "$OUT/push.err"; then
    cat "$OUT/push.err" >&2
    if grep -q "workflow" "$OUT/push.err"; then
      say "push refused: upstream changed .github/workflows and this token lacks the workflows permission."
      say "Add a fine-grained token with contents, pull requests and workflows write as the UPSTREAM_SYNC_TOKEN secret."
    fi
    return 1
  fi
}

upsert_pr() {  # $1 = title, $2 = body file, $3 = draft|ready
  if [ "$DRY_RUN" = 1 ]; then say "dry run: PR '$1' ($3)"; cat "$2"; return 0; fi
  if [ -z "$pr" ]; then
    local draft=(); [ "$3" = draft ] && draft=(--draft)
    gh pr create -R "$REPO" --base "$BASE" --head "$BRANCH" --title "$1" --body-file "$2" "${draft[@]}"
  else
    gh pr edit "$pr" -R "$REPO" --title "$1" --body-file "$2"
    if [ "$3" = draft ]; then gh pr ready "$pr" -R "$REPO" --undo >/dev/null 2>&1 || true
    else gh pr ready "$pr" -R "$REPO" >/dev/null 2>&1 || true; fi
  fi
}

title="Upstream sync: ${behind} commits through ${up_short}${up_version:+ (NetClaw $up_version)}"
body="$OUT/body.md"

if [ "$human" -gt 0 ]; then
  say "sync branch carries $human resolution commit(s); merging new upstream commits on top"
  git checkout --quiet -B upstream-sync-work "origin/$BRANCH"
  if git merge --quiet --no-ff --no-edit -m "Merge upstream NetClaw $up_short into $BRANCH" upstream/main; then
    push_branch HEAD plain
    [ "$DRY_RUN" = 1 ] || gh pr comment "$pr" -R "$REPO" --body "Merged new upstream commits through \`$up_short\` on top of the resolution work."
  else
    files=$(git diff --name-only --diff-filter=U | sed 's/^/- `/; s/$/`/')
    git merge --abort
    say "new upstream commits conflict with the resolution work"
    [ "$DRY_RUN" = 1 ] || gh pr comment "$pr" -R "$REPO" --body "$(printf 'Upstream moved to `%s`, and merging it into this branch conflicts in:\n\n%s\n\nMerge `upstream/main` into `%s` locally and push.' "$up_short" "$files" "$BRANCH")"
  fi
  exit 0
fi

git checkout --quiet -B upstream-sync-work "origin/$BASE"
if git merge --quiet --no-ff --no-edit -m "Merge upstream NetClaw ${up_version:-$up_short} ($up_short)" upstream/main; then
  state=ready
  run_checks || state=draft
  {
    echo "## Summary"; echo
    echo "Merges upstream \`automateyournetwork/netclaw\` main \`$up_short\` into \`$BASE\`: $behind commits. The merge was clean."; echo
    commit_list; echo
    echo "## Evidence"; echo
    echo "Fast offline checks on the merged tree:"; echo
    cat "$OUT/checks.md"; echo
    echo "These are not the full contract suites. Before merging, run the affected suites as described in \`docs/runbooks/upstream-sync.md\`."; echo
    echo "## Merge Danger"; echo
    echo "**Door:** two-way"; echo
    echo "Reverting the merge commit restores the previous \`$BASE\`. The live HUD checkout is not updated by this PR."; echo
    echo "**Blast Radius:** upstream-wide"; echo
    echo "Anything upstream changed reaches the fork. Review the commit list for areas the fork extends: Convergence, the HUD and the installer."
  } > "$body"
  push_branch HEAD force
  upsert_pr "$title" "$body" "$state"
else
  files=$(git diff --name-only --diff-filter=U)
  count=$(printf '%s\n' "$files" | grep -c . || true)
  git merge --abort
  {
    echo "## Summary"; echo
    echo "Upstream \`automateyournetwork/netclaw\` main is at \`$up_short\`, $behind commits ahead of \`$BASE\`. Merging it conflicts in $count file(s):"; echo
    printf '%s\n' "$files" | sed 's/^/- `/; s/$/`/'; echo
    echo "This branch holds upstream's main as it is, so GitHub shows the conflicts. To resolve them:"; echo
    echo '```sh'
    echo "git fetch origin $BRANCH && git checkout -B $BRANCH origin/$BRANCH"
    echo "git merge origin/$BASE   # resolve, test as in docs/runbooks/upstream-sync.md"
    echo "git push origin $BRANCH  # the daily job keeps commits pushed here"
    echo '```'; echo
    commit_list; echo
    echo "## Merge Danger"; echo
    echo "**Door:** two-way"; echo
    echo "**Blast Radius:** upstream-wide"
  } > "$body"
  push_branch upstream/main force
  upsert_pr "$title (conflicts: $count files)" "$body" draft
fi
