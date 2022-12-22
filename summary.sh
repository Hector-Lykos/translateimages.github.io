#!/bin/bash
jq -r '"\(.charCount) \(.hash) \(.srcLang)"' log/results | awk '(!n[$2]++) {x++; z+=$1} (!p[$2 $3]++) {y+=$1} END {a=1.5*x; b=.01*y; c=a+b; print "req: " NR " " x " char: " z " " y " char/im: " z/x " " y/x " cost: " a " " b " " c " cost/req: " a/NR " " b/NR " " c/NR}'
