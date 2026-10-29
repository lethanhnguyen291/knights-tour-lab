// Warnsdorff ordering guides a depth-first backtracking search.
export const SIZE = 8;
const OFFSETS = [
  [-2, -1], [-2, 1], [-1, -2], [-1, 2],
  [1, -2], [1, 2], [2, -1], [2, 1],
];

export function coordinate(index) {
  const row = Math.floor(index / SIZE);
  const col = index % SIZE;
  return `${String.fromCharCode(65 + col)}${SIZE - row}`;
}

export function neighbors(index) {
  const row = Math.floor(index / SIZE);
  const col = index % SIZE;
  return OFFSETS
    .map(([dy, dx]) => [row + dy, col + dx])
    .filter(([r, c]) => r >= 0 && r < SIZE && c >= 0 && c < SIZE)
    .map(([r, c]) => r * SIZE + c);
}

export function findTour(start) {
  if (!Number.isInteger(start) || start < 0 || start >= SIZE * SIZE) {
    throw new RangeError('Ô xuất phát phải nằm trên bàn cờ.');
  }

  const adj = Array.from({ length: SIZE * SIZE }, (_, i) => neighbors(i));
  const used = new Uint8Array(SIZE * SIZE);
  const path = [start];
  let backtracks = 0;
  used[start] = 1;

  function search(current) {
    if (path.length === SIZE * SIZE) return true;
    const degree = (square) => adj[square].reduce((n, next) => n + (used[next] ? 0 : 1), 0);
    const choices = adj[current]
      .filter((square) => !used[square])
      .map((square) => ({ square, onward: degree(square) }))
      .sort((a, b) => a.onward - b.onward || a.square - b.square);

    for (const { square } of choices) {
      used[square] = 1;
      path.push(square);
      if (search(square)) return true;
      path.pop();
      used[square] = 0;
      backtracks++;
    }
    return false;
  }

  const solved = search(start);
  return { path: solved ? [...path] : [], backtracks, solved };
}

// Search from the player's exact visited prefix. The node budget keeps a hard
// limit on difficult positions; reaching it yields an explicitly heuristic hint.
export function suggestMove(prefix, nodeBudget = 50000) {
  if (!Array.isArray(prefix) || prefix.length < 1 || prefix.length >= 64 ||
      prefix.some((square) => !Number.isInteger(square) || square < 0 || square >= 64) ||
      new Set(prefix).size !== prefix.length ||
      prefix.some((square, i) => i > 0 && !neighbors(prefix[i - 1]).includes(square))) {
    throw new RangeError('Hành trình hiện tại không hợp lệ.');
  }
  const adj = Array.from({ length: 64 }, (_, i) => neighbors(i));
  const used = new Uint8Array(64);
  prefix.forEach((square) => { used[square] = 1; });
  const current = prefix[prefix.length - 1];
  const degree = (square) => adj[square].reduce((n, next) => n + (used[next] ? 0 : 1), 0);
  const sortedChoices = (square) => adj[square].filter((next) => !used[next])
    .map((next) => ({ next, onward: degree(next) }))
    .sort((a, b) => a.onward - b.onward || a.next - b.next)
    .map(({ next }) => next);
  const choices = sortedChoices(current);
  if (!choices.length) return { square: null, quality: 'stuck', explored: 0 };

  let explored = 0;
  let limitReached = false;
  function search(square, length) {
    if (length === 64) return true;
    if (explored >= nodeBudget) {
      limitReached = true;
      return false;
    }
    for (const next of sortedChoices(square)) {
      if (explored >= nodeBudget) {
        limitReached = true;
        break;
      }
      used[next] = 1;
      explored++;
      if (search(next, length + 1)) return true;
      used[next] = 0;
    }
    return false;
  }
  for (const square of choices) {
    used[square] = 1;
    explored++;
    const solved = search(square, prefix.length + 1);
    used[square] = 0;
    if (solved) return { square, quality: 'solved', explored };
    if (limitReached) break;
  }
  return limitReached
    ? { square: choices[0], quality: 'heuristic', explored }
    : { square: null, quality: 'no-completion', explored };
}
