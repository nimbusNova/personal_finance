#!/bin/bash
cd "$(dirname "$0")/web"
bun test --testPathPattern="e2e/"
