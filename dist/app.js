import { coordinate, findTour, neighbors, suggestMove } from './tour.js';

const $ = (selector) => document.querySelector(selector);
const board = $('#board');
const trail = $('#trail');
const history = $('#history');
const stepButton = $('#step-button');
const playButton = $('#play-button');
const pauseButton = $('#pause-button');
const resetButton = $('#reset-button');
const hintButton = $('#hint-button');
const undoButton = $('#undo-button');
const speed = $('#speed');
const cells = [];
const state = {
  mode: 'simulation', start: null, path: [], shown: 0, backtracks: 0,
  status: 'idle', timer: null, request: 0, hint: null,
};

function stopTimer() {
  if (state.timer !== null) clearTimeout(state.timer);
  state.timer = null;
}

function setStatus(status, detail) {
  state.status = status;
  const messages = {
    idle: ['Chọn ô xuất phát', 'Nhấp một ô trên bàn cờ để bắt đầu.', 'Sẵn sàng'],
    searching: ['Đang tìm hành trình…', 'Sắp xếp nước đi theo Warnsdorff và quay lui khi cần.', 'Đang tìm'],
    ready: ['Đã tìm thấy hành trình', 'Bấm “Từng bước” hoặc “Tự động” để xem quân mã di chuyển.', 'Sẵn sàng'],
    running: ['Đang mô phỏng', 'Quan sát số thứ tự trên mỗi ô đã đi qua.', 'Đang chạy'],
    paused: ['Đã tạm dừng', 'Tiếp tục tự động hoặc đi một bước theo ý bạn.', 'Tạm dừng'],
    exploring: ['Tới lượt bạn', 'Chọn một ô có dấu tròn để đi nước mã tiếp theo.', 'Tự khám phá'],
    thinking: ['AI đang tìm…', 'Đang kiểm tra nước đi từ hành trình của bạn.', 'Đang tìm'],
    hint: ['AI đã gợi ý', 'Ô có viền xanh là nước đi AI đề xuất. Bạn vẫn tự quyết định.', 'Gợi ý'],
    invalid: ['Nước đi không hợp lệ', 'Quân mã phải đi hình chữ L tới ô chưa thăm. Chọn ô có dấu tròn.', 'Thử lại'],
    deadend: ['Không thể hoàn tất', 'AI không tìm thấy đường đi đủ 64 ô từ đây. Quay lại thử nhánh khác.', 'Cần quay lại'],
    complete: ['Hoàn thành 64/64 ô', 'Quân mã đã ghé mỗi ô đúng một lần. Xuất sắc!', 'Hoàn thành'],
    stuck: ['Bị kẹt', 'Không còn ô hợp lệ. Dùng “Quay lại” để thử nhánh khác.', 'Bị kẹt'],
  };
  const [title, defaultDetail, pill] = messages[status];
  $('#status-text').textContent = title;
  $('#status-detail').textContent = detail || defaultDetail;
  $('#status-pill').textContent = pill;
  $('#status-pill').dataset.status = status;
  const canSimMove = state.mode === 'simulation' && ['ready', 'paused'].includes(status) && state.shown < 64;
  stepButton.disabled = !canSimMove;
  playButton.disabled = !canSimMove;
  pauseButton.disabled = state.mode !== 'simulation' || status !== 'running';
  hintButton.disabled = state.mode !== 'explore' || state.shown === 0 || state.shown === 64 || status === 'thinking';
  undoButton.disabled = state.mode !== 'explore' || state.shown <= 1 || status === 'thinking';
  resetButton.disabled = status === 'idle';
}

function availableMoves() {
  if (!state.shown || state.shown === 64) return [];
  const visited = new Set(state.path.slice(0, state.shown));
  return neighbors(state.path[state.shown - 1]).filter((square) => !visited.has(square));
}

function render() {
  $('#visit-count').textContent = state.shown;
  $('#backtrack-count').textContent = state.backtracks.toLocaleString('vi-VN');
  $('#current-square').textContent = state.shown ? coordinate(state.path[state.shown - 1]) : '—';
  $('#progress-bar').style.width = `${(state.shown / 64) * 100}%`;
  $('#progress-text').textContent = `${Math.round((state.shown / 64) * 100)}%`;
  const visited = new Map(state.path.slice(0, state.shown).map((square, i) => [square, i + 1]));
  const current = state.shown ? state.path[state.shown - 1] : null;
  const reachable = availableMoves();

  cells.forEach((cell, index) => {
    const order = visited.get(index);
    cell.classList.toggle('visited', Boolean(order));
    cell.classList.toggle('current', index === current);
    cell.classList.toggle('origin', index === state.start && state.shown > 0);
    cell.classList.toggle('reachable', reachable.includes(index));
    cell.classList.toggle('hinted', index === state.hint && state.mode === 'explore');
    cell.querySelector('.order').textContent = order ?? '';
    cell.querySelector('.piece').textContent = index === current ? '♞' : '';
    const action = state.shown === 0 ? 'Chọn làm ô xuất phát' :
      state.mode === 'explore' ? reachable.includes(index) ? 'Có thể đi tới' : 'Không thể đi tới' : 'Chọn làm ô xuất phát';
    cell.setAttribute('aria-label', `${coordinate(index)}${order ? `, nước ${order}` : ''}${index === current ? ', vị trí hiện tại' : ''}${index === state.hint ? ', AI gợi ý' : ''}. ${action}`);
  });

  trail.setAttribute('points', state.path.slice(0, state.shown).map((square) =>
    `${(square % 8 + .5) * 100},${(Math.floor(square / 8) + .5) * 100}`).join(' '));
  history.replaceChildren();
  if (!state.shown) {
    const empty = document.createElement('li');
    empty.className = 'history-empty';
    empty.textContent = 'Các nước đi sẽ hiện tại đây.';
    history.append(empty);
  } else {
    const fragment = document.createDocumentFragment();
    state.path.slice(0, state.shown).forEach((square, i) => {
      const item = document.createElement('li');
      item.className = i === state.shown - 1 ? 'history-item latest' : 'history-item';
      const n = document.createElement('span');
      n.className = 'history-number';
      n.textContent = String(i + 1).padStart(2, '0');
      const name = document.createElement('strong');
      name.textContent = coordinate(square);
      const sub = document.createElement('span');
      sub.textContent = i === 0 ? 'Xuất phát' : `từ ${coordinate(state.path[i - 1])}`;
      item.append(n, name, sub);
      fragment.append(item);
    });
    history.append(fragment);
    history.scrollTop = history.scrollHeight;
  }
}

function advance() {
  if (state.mode !== 'simulation' || state.shown >= state.path.length) return;
  state.shown++;
  render();
  if (state.shown === 64) {
    stopTimer();
    setStatus('complete');
  } else if (state.status !== 'running') setStatus('paused');
}

function tick() {
  if (state.status !== 'running') return;
  advance();
  if (state.status === 'running') state.timer = setTimeout(tick, Number(speed.value));
}

function reset() {
  stopTimer();
  state.request++;
  state.start = null;
  state.path = [];
  state.shown = 0;
  state.backtracks = 0;
  state.hint = null;
  render();
  setStatus('idle', state.mode === 'explore' ? 'Chọn một ô xuất phát, sau đó tự tìm nước đi.' : undefined);
}

function chooseStart(index) {
  stopTimer();
  const request = ++state.request;
  state.start = index;
  state.path = [];
  state.shown = 0;
  state.backtracks = 0;
  state.hint = null;
  if (state.mode === 'explore') {
    state.path = [index];
    state.shown = 1;
    render();
    setStatus('exploring');
    return;
  }
  render();
  setStatus('searching');
  setTimeout(() => {
    if (request !== state.request) return;
    const result = findTour(index);
    if (request !== state.request) return;
    state.path = result.path;
    state.backtracks = result.backtracks;
    state.shown = result.solved ? 1 : 0;
    render();
    setStatus(result.solved ? 'ready' : 'stuck',
      result.solved ? undefined : 'Không tìm được hành trình từ ô này. Hãy thử ô khác.');
  }, 0);
}

function chooseCell(index) {
  if (state.mode === 'simulation' || !state.shown) {
    chooseStart(index);
    return;
  }
  if (state.shown === 64) return;
  if (state.status === 'thinking') return;
  if (!availableMoves().includes(index)) {
    setStatus('invalid');
    return;
  }
  state.path.push(index);
  state.shown++;
  state.hint = null;
  render();
  setStatus(state.shown === 64 ? 'complete' : availableMoves().length ? 'exploring' : 'stuck');
}

function setMode(mode) {
  if (mode === state.mode) return;
  state.mode = mode;
  $('#simulation-mode').classList.toggle('active', mode === 'simulation');
  $('#explore-mode').classList.toggle('active', mode === 'explore');
  $('#simulation-mode').setAttribute('aria-pressed', mode === 'simulation');
  $('#explore-mode').setAttribute('aria-pressed', mode === 'explore');
  $('#explore-controls').hidden = mode !== 'explore';
  $('#speed-controls').hidden = mode !== 'simulation';
  stepButton.hidden = mode === 'explore';
  playButton.hidden = mode === 'explore';
  pauseButton.hidden = mode === 'explore';
  $('.buttons').classList.toggle('explore', mode === 'explore');
  $('#backtrack-label').textContent = mode === 'explore' ? 'Lần quay lại' : 'Lần quay lui';
  $('#board-instruction').textContent = mode === 'explore'
    ? 'Chọn ô xuất phát, rồi nhấp ô có dấu tròn để tự đi. AI chỉ gợi ý khi bạn cần.'
    : 'Chọn một ô bất kỳ để bắt đầu. Nhấp ô khác để đổi điểm xuất phát.';
  board.setAttribute('aria-label', mode === 'explore' ? 'Bàn cờ 8 nhân 8; tự chọn nước đi' : 'Bàn cờ 8 nhân 8; chọn ô xuất phát');
  reset();
}

for (let row = 0; row < 8; row++) {
  for (let col = 0; col < 8; col++) {
    const index = row * 8 + col;
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = `cell ${(row + col) % 2 ? 'dark' : 'light'}`;
    cell.innerHTML = '<span class="order" aria-hidden="true"></span><span class="piece" aria-hidden="true"></span>';
    cell.addEventListener('click', () => chooseCell(index));
    board.append(cell);
    cells.push(cell);
  }
}

$('#simulation-mode').addEventListener('click', () => setMode('simulation'));
$('#explore-mode').addEventListener('click', () => setMode('explore'));
stepButton.addEventListener('click', advance);
playButton.addEventListener('click', () => {
  if (state.mode !== 'simulation' || state.shown >= 64 || !state.path.length) return;
  stopTimer();
  setStatus('running');
  state.timer = setTimeout(tick, Number(speed.value));
});
pauseButton.addEventListener('click', () => {
  stopTimer();
  setStatus('paused');
});
resetButton.addEventListener('click', reset);
undoButton.addEventListener('click', () => {
  if (state.mode !== 'explore' || state.shown <= 1) return;
  state.path.pop();
  state.shown--;
  state.backtracks++;
  state.hint = null;
  render();
  setStatus('exploring', 'Đã quay lại một nước. Chọn hướng khác để tiếp tục.');
});
hintButton.addEventListener('click', () => {
  if (state.mode !== 'explore' || !state.shown || state.shown === 64) return;
  state.hint = null;
  const request = ++state.request;
  setStatus('thinking');
  render();
  setTimeout(() => {
    if (request !== state.request || state.mode !== 'explore') return;
    const result = suggestMove(state.path);
    if (result.square !== null) {
      state.hint = result.square;
      const detail = result.quality === 'solved'
        ? `AI gợi ý ${coordinate(result.square)}: đã tìm được đường đi đủ 64 ô từ hành trình hiện tại.`
        : `AI gợi ý ${coordinate(result.square)} theo Warnsdorff; chưa chứng minh được đường đi đủ 64 ô. Bạn có thể thử hoặc quay lại.`;
      render();
      setStatus('hint', detail);
    } else {
      render();
      setStatus(result.quality === 'stuck' ? 'stuck' : 'deadend', result.quality === 'stuck'
        ? 'Không còn nước hợp lệ. Dùng “Quay lại” để đổi hướng.'
        : 'AI không tìm thấy đường đi đủ 64 ô từ các lựa chọn hiện tại. Hãy quay lại thử nhánh khác.');
    }
  }, 0);
});
speed.addEventListener('input', () => {
  $('#speed-label').textContent = `${(Number(speed.value) / 1000).toFixed(1).replace('.', ',')} giây / bước`;
  if (state.status === 'running') {
    stopTimer();
    state.timer = setTimeout(tick, Number(speed.value));
  }
});
reset();
