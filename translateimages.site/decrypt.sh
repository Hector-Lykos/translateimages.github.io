#!/bin/bash
key=$1
iv=$(head -c 16 | xxd -p)
openssl enc -aes-256-ctr -d -K "$key" -iv "$iv"
