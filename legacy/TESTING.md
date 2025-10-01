# Testing Guide

This project uses a comprehensive testing strategy to ensure poker hand evaluation correctness.

## Test Types

### 1. Unit Tests

Core functionality tests for individual components:

- `test/deck.test.ts` - Deck creation and shuffling
- `test/evaluator-rankings.test.ts` - Hand ranking correctness
- `test/evaluator-ties.test.ts` - Tie-breaking accuracy
- `test/engine-flow.test.ts` - Game engine state management

### 2. Property-Based Tests

Random testing using fast-check:

- `test/properties.test.ts` - No duplicate cards, valid best5 selection

### 3. End-to-End Tests

Full CLI testing with golden snapshots:

- `test/cli.e2e.test.ts` - Complete game sessions with deterministic output

### 4. Differential Tests

Comparison against known-good implementations:

- `test/diff.test.ts` - Curated oracle test vectors (118 cases)
- `test/random-diff.test.ts` - Random comparison against poker-evaluator

## Running Tests

### Standard Test Suite

```bash
# Run all canonical tests (fast, deterministic)
npm test

# Watch mode for development
npm run watch:test

# E2E tests only
npm run e2e
```

### Differential Oracle Testing

```bash
# Run random differential tests (2000 deals)
DIFF_ORACLE=1 npm test

# Strict mode (fail on any mismatch)
DIFF_ORACLE=1 STRICT_DIFF=1 npm test

# Random diff tests only
DIFF_ORACLE=1 npm test test/random-diff.test.ts
```

## Differential Testing Details

### Category & Rank Normalization

Our implementation uses categories 0-8:

- 0: HIGH_CARD
- 1: ONE_PAIR
- 2: TWO_PAIR
- 3: THREE_OF_A_KIND
- 4: STRAIGHT
- 5: FLUSH
- 6: FULL_HOUSE
- 7: FOUR_OF_A_KIND
- 8: STRAIGHT_FLUSH

poker-evaluator uses categories 1-9 with the same order.

### Wheel Straight Handling

The wheel straight (A-2-3-4-5) is normalized consistently:

- High card is 5 (not Ace)
- Ace is treated as rank 1 in comparison
- Both STRAIGHT and STRAIGHT_FLUSH handle this correctly

### Primary Rank Comparison

For each hand type, we compare the "primary ranks":

- **Pairs/Trips/Quads**: The rank of the matched cards
- **Two Pair**: Both pair ranks (higher first)
- **Straights**: High card of the straight
- **Flushes/High Card**: Highest card

## Mismatch Handling

When the random differential test finds disagreements:

1. **Console Output**: Detailed mismatch info with repro command
2. **Pending Cases**: Saved to `test/data/pending_cases.json`
3. **Deduplication**: Only unique card combinations saved
4. **Metadata**: Includes seed, git SHA, poker-evaluator version

### Pending Cases Schema

```json
{
  "schema": "pending-v1",
  "cards": ["As", "Kd", "Qh", "Jc", "Ts", "9s", "9d"],
  "our": {
    "cat": 4,
    "ranks": [12, 11, 10, 9, 8],
    "best5": ["As", "Kd", "Qh", "Jc", "Ts"]
  },
  "their": {
    "cat": 4,
    "ranks": [12, 11, 10, 9, 8]
  },
  "seed": 123456789,
  "peVersion": "2.1.1",
  "git": "abcdef1",
  "note": "category mismatch | ranks mismatch",
  "addedAt": "2025-09-22T15:20:00Z"
}
```

## Workflow for Growing Oracle

1. **Run differential tests**: `DIFF_ORACLE=1 npm test`
2. **Review pending cases**: Check `test/data/pending_cases.json`
3. **Manual verification**: Confirm correct behavior for each case
4. **Migrate worthy cases**: Add to `test/data/oracle7.json` with reason annotation
5. **Clear pending**: Remove cases from `pending_cases.json` after review

### Adding to Oracle

When migrating a pending case, include a comment explaining the edge case:

```json
{
  "cards": ["5s", "4d", "3h", "2c", "As", "Kh", "Qc"],
  "rank": "STRAIGHT",
  "high": "5",
  "_comment": "wheel straight: A-2-3-4-5"
}
```

## CI Configuration

### Standard Pipeline

```bash
npm test  # Fast, deterministic canonical tests only
```

### Extended Pipeline (Separate Job)

```bash
DIFF_ORACLE=1 STRICT_DIFF=1 npm test test/random-diff.test.ts
```

This separation ensures:

- Fast feedback on normal changes
- Comprehensive validation without noise
- Clear failure attribution

## Performance Expectations

- **Unit tests**: <100ms total
- **Property tests**: <1s (100 runs each)
- **E2E tests**: <200ms total
- **Differential oracle**: <50ms (118 cases)
- **Random differential**: ~10s (2000 deals)

## Troubleshooting

### Repro Commands

When a mismatch occurs, use the printed repro command:

```bash
node -e "const {evaluateSeven}=require('./dist/evaluator.js');console.log(evaluateSeven([{rank:'A',suit:'s'},{rank:'K',suit:'d'},...]))"
```

### Common Edge Cases

- **Wheel straights**: A-2-3-4-5 (high card = 5)
- **Board plays**: When community cards are best hand for all players
- **Kicker ordering**: Secondary/tertiary ranks in ties
- **Flush vs straight**: When both are possible from 7 cards

### Debug Mode

For detailed evaluation logging, modify the evaluator temporarily or use the CLI:

```bash
npm run dev
> seed 12345
> deal
> hole 1
```

## Acceptance Criteria

✓ `npm test` passes (canonical tests only)
✓ `DIFF_ORACLE=1 npm test` completes without critical mismatches
✓ Known edge cases (wheel, board flush) proven to match
✓ Pending cases workflow documented and functional
✓ Performance targets met across all test types
