#!/bin/bash
jq '(now - .time/1000)/3600' log/results | tail
