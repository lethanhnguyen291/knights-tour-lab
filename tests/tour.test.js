import test from 'node:test';
import assert from 'node:assert/strict';
import { findTour, neighbors, suggestMove } from '../dist/tour.js';

test('all starting squares yield a legal 64-square tour', () => {
  for (let start = 0; start < 64; start++) {
    const result = findTour(start);
    assert.equal(result.solved, true, `start ${start}`);
    assert.equal(result.path.length, 64);
    assert.equal(new Set(result.path).size, 64);
    assert.equal(result.path[0], start);
    for (let i = 1; i < result.path.length; i++) {
      assert.ok(neighbors(result.path[i - 1]).includes(result.path[i]));
    }
  }
});

test("AI suggestion extends the player's actual route to a complete tour", () => {
  const tour = findTour(0).path;
  for (const length of [1, 2, 8, 20, 48, 63]) {
    const prefix = tour.slice(0, length);
    const suggestion = suggestMove(prefix);
    assert.equal(suggestion.quality, 'solved', `prefix of ${length}`);
    assert.ok(neighbors(prefix.at(-1)).includes(suggestion.square));
    assert.ok(!prefix.includes(suggestion.square));
  }
});

test('AI detects a route with no remaining legal move', () => {
  const route = [0];
  while (route.length < 64) {
    const choices = neighbors(route.at(-1)).filter((square) => !route.includes(square));
    if (!choices.length) break;
    route.push(choices[0]);
  }
  assert.ok(route.length < 64);
  assert.deepEqual(suggestMove(route), { square: null, quality: 'stuck', explored: 0 });
  assert.ok(route.length > 1, 'the last step can be undone');
});
