#!/bin/bash

# Test script to verify eliminated players don't participate in new hands
echo "Testing player elimination..."
echo ""
echo "This test will:"
echo "1. Start with 3 players (1000 chips each)"
echo "2. Have Player 1 go all-in and lose"
echo "3. Verify Player 1 is not dealt into the next hand"
echo ""

# Run the CLI in interactive mode with test input
# Format: players, stack, sb, bb, ante
node dist/cli.js << 'EOF'
3
1000
10
20
0
n
n
y
allin
y
fold
y
call
y
y
n
EOF

echo ""
echo "Test complete! Check the output above to verify Player 1 was not dealt into hand #2."