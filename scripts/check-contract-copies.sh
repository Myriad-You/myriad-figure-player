#!/bin/sh
# contracts/ holds byte copies of files in myriad-core, at the revision in contracts/core-revision.
# Fails if a copy differs from core's file at that revision, NOTICE cites another revision or does
# not name a copy and its source, or contracts/ holds a JSON file this list does not.
set -eu
cd "$(dirname "$0")/.."
revision="$(tr -d '[:space:]' < contracts/core-revision)"
grep -q "revision ${revision%"${revision#?????????}"}" NOTICE || { echo "NOTICE does not cite core revision $revision" >&2; exit 1; }
failed=0
listed=""
while read -r copy source; do
  listed="$listed $copy"
  for name in "contracts/$copy" "$source"; do
    grep -qF "$name" NOTICE || { echo "NOTICE does not name $name" >&2; failed=1; }
  done
  if curl -fsSL "https://raw.githubusercontent.com/Myriad-You/myriad-core/$revision/$source" | cmp -s - "contracts/$copy"; then
    echo "contracts/$copy = myriad-core@$revision:$source"
  else
    echo "contracts/$copy differs from myriad-core@$revision:$source" >&2
    failed=1
  fi
done <<'LIST'
merope_rig_contract.json shared/merope_rig_contract.json
merope_performance_contract.json shared/merope_performance_contract.json
figure_package_conformance.json crates/conformance/v1/figure/package.json
LIST
for file in contracts/*.json; do
  case " $listed " in *" ${file#contracts/} "*) ;; *) echo "$file is not a listed copy of myriad-core" >&2; failed=1 ;; esac
done
exit "$failed"
