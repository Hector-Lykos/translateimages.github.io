#!/bin/bash
grep '^{[^{}]*}$' log/results \
  | tac \
  | jq -r '.hash' \
  | grep -xP '[0-9a-f]{64}' \
  | awk '{if (NR > 100000 && !n[$1]) print $1; n[$1]=1}' \
  | while read -r f; do
      compgen -G "cache/$f.*.json" \
        | xargs -r rm --
    done
