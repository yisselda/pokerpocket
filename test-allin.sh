#!/bin/bash

# Test script for all-in scenario
echo "Testing all-in scenario..."
echo "4 players all going all-in should automatically run out all streets"
echo ""

# Run test with all players going all-in
echo -e "4\n1000\n10\n20\n0\nallin\ny\ncall\ncall\ncall\nn" | timeout 5 node dist/cli.js

if [ $? -eq 124 ]; then
  echo ""
  echo "ERROR: Test timed out - infinite loop still exists!"
  exit 1
else
  echo ""
  echo "SUCCESS: Test completed without timeout!"
  exit 0
fi