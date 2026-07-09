const DEFAULT_PLAYERS = [
  'Reece', 'Flavio', 'Charles', 'Luke', 'Paul', 'Shannon', 'Alberto', 'Brendan',
  'Gui', 'Renan', 'Igor', 'Jason', 'Felipe', 'Jamie', 'Ben', 'Elton', 'Rob',
  'Axel', 'Javier', 'Chris', 'Duncan', 'Marcos', 'Stephen',
];

const STORAGE_KEY = 'harbord-motm-state-v2';
const LEGACY_STORAGE_KEY = 'harbord-motm-state-v1';
const app = document.querySelector('#app');

let draftVote = { three: '', two: '', one: '' };
let voterName = '';
let errorMessage = '';
let state = loadState();

function freshState() {
  return {
    screen: 'setup',
    matchName: '',
    players: [...DEFAULT_PLAYERS],
    goals: {},
    assists: {},
    votes: [],
    savedGames: [],
  };
}

function normaliseState(raw = {}) {
  return {
    ...freshState(),
    ...raw,
    players: Array.isArray(raw.players) && raw.players.length ? raw.players : [...DEFAULT_PLAYERS],
    goals: raw.goals || {},
    assists: raw.assists || {},
    votes: Array.isArray(raw.votes) ? raw.votes : [],
    savedGames: Array.isArray(raw.savedGames) ? raw.savedGames : Array.isArray(raw.history) ? raw.history : [],
  };
}

function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    return normaliseState(stored ? JSON.parse(stored) : {});
  } catch {
    return freshState();
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function updateState(patch) {
  state = normaliseState({ ...state, ...patch });
  persist();
  render();
}

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[char]));
}

function countFor(player, type) {
  return Number(state[type][player] || 0);
}

function iconStack(count, icon, label, className) {
  if (!count) return '';
  const icons = Array.from({ length: count }, () => `<span class="${className}">${icon}</span>`).join('');
  return `<span class="icons" aria-label="${count} ${label}">${icons}</span>`;
}

function playerBadges(player) {
  return `${iconStack(countFor(player, 'goals'), '⚽', 'goals', 'ball')}${iconStack(countFor(player, 'assists'), '🥾', 'assists', 'boot')}`;
}

function scoreVotes(votes, players) {
  const rows = Object.fromEntries(players.map(player => [player, {
    name: player,
    points: 0,
    firsts: 0,
    seconds: 0,
    thirds: 0,
  }]));

  votes.forEach(vote => {
    const first = vote.three || vote.p3;
    const second = vote.two || vote.p2;
    const third = vote.one || vote.p1;
    if (rows[first]) {
      rows[first].points += 3;
      rows[first].firsts += 1;
    }
    if (rows[second]) {
      rows[second].points += 2;
      rows[second].seconds += 1;
    }
    if (rows[third]) {
      rows[third].points += 1;
      rows[third].thirds += 1;
    }
  });

  return Object.values(rows).sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
}

function withPlaces(rows) {
  let currentPlace = 0;
  let previousPoints = null;
  return rows.map((row, index) => {
    if (row.points !== previousPoints) {
      currentPlace = index + 1;
      previousPoints = row.points;
    }
    return { ...row, place: currentPlace };
  });
}

function sumStat(games, type) {
  const totals = {};
  games.forEach(game => {
    Object.entries(game[type] || {}).forEach(([player, count]) => {
      totals[player] = (totals[player] || 0) + Number(count || 0);
    });
  });
  return Object.entries(totals)
    .map(([name, count]) => ({ name, count }))
    .filter(row => row.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function saveCurrentMatchToRecords() {
  if (!state.votes.length) return state.savedGames;
  const savedGame = {
    id: uid(),
    date: new Date().toISOString(),
    matchName: state.matchName.trim() || 'Untitled match',
    players: [...state.players],
    goals: { ...state.goals },
    assists: { ...state.assists },
    votes: [...state.votes],
  };
  return [savedGame, ...state.savedGames];
}

function navigation() {
  return `
    <nav aria-label="App sections">
      <button data-screen="setup">Setup</button>
      <button data-screen="voting" ${state.players.length < 3 ? 'disabled' : ''}>Voting</button>
      <button data-screen="results">Results</button>
      <button data-screen="records">Records</button>
    </nav>
  `;
}

function pageShell(content) {
  return `
    <div class="logo" aria-label="Harbord FC logo">
      <div class="crestTop">HARBORD FC</div>
      <div class="waves">≋≋≋</div>
      <div class="crestBall">⚽</div>
    </div>
    <header>
      <h1>Man of the Match</h1>
      <p>Harbord FC social football voting</p>
    </header>
    ${navigation()}
    ${errorMessage ? `<p class="error" role="alert">${escapeHtml(errorMessage)}</p>` : ''}
    ${content}
    <button class="danger wide" id="resetMatch">Reset / New Match</button>
  `;
}

function renderSetup() {
  const playerRows = state.players.map(player => `
    <li>
      <b>${escapeHtml(player)}</b>
      <div class="statControls">
        ${renderStatControl(player, 'goals', 'Goals', '⚽')}
        ${renderStatControl(player, 'assists', 'Assists', '🥾')}
      </div>
      <button data-edit-player="${escapeHtml(player)}">Edit</button>
      <button class="danger" data-remove-player="${escapeHtml(player)}">Remove</button>
    </li>
  `).join('');

  return pageShell(`
    <section class="card">
      <h2>Setup match</h2>
      <label>Match name
        <input id="matchName" value="${escapeHtml(state.matchName)}" placeholder="Saturday 7-a-side" autocomplete="off">
      </label>
      <h3>Players (${state.players.length})</h3>
      <div class="add">
        <input id="newPlayer" placeholder="Add player" autocomplete="off">
        <button id="addPlayer">Add</button>
      </div>
      <ul class="players">${playerRows}</ul>
      <button class="primary wide" id="startVoting">Start Voting</button>
    </section>
  `);
}

function renderStatControl(player, type, label, fallbackIcon) {
  const value = countFor(player, type);
  const icons = type === 'goals'
    ? iconStack(value, '⚽', 'goals', 'ball')
    : iconStack(value, '🥾', 'assists', 'boot');
  return `
    <div class="stat">
      <span>${label}</span>
      <button data-stat="${type}" data-stat-player="${escapeHtml(player)}" data-delta="-1" aria-label="Remove ${label.toLowerCase()} for ${escapeHtml(player)}">−</button>
      <strong>${icons || `0 ${fallbackIcon}`}</strong>
      <button data-stat="${type}" data-stat-player="${escapeHtml(player)}" data-delta="1" aria-label="Add ${label.toLowerCase()} for ${escapeHtml(player)}">+</button>
    </div>
  `;
}

function renderVoting() {
  const voteComplete = draftVote.three && draftVote.two && draftVote.one && new Set(Object.values(draftVote)).size === 3;
  return pageShell(`
    <section class="card">
      <h2>${escapeHtml(state.matchName || 'Match voting')}</h2>
      <p class="pill">Votes collected: ${state.votes.length}</p>
      <label>Voter name (optional)
        <input id="voterName" value="${escapeHtml(voterName)}" autocomplete="off">
      </label>
      ${renderVoteSection('three', '3 points')}
      ${renderVoteSection('two', '2 points')}
      ${renderVoteSection('one', '1 point')}
      <button class="primary wide" id="saveVote" ${voteComplete ? '' : 'disabled'}>Save Vote</button>
      <h3>Saved votes</h3>
      ${state.votes.length ? state.votes.map(renderSavedVote).join('') : '<p class="hint">No votes saved yet.</p>'}
      <button class="wide" data-screen="results">View Results</button>
    </section>
  `);
}

function renderVoteSection(slot, label) {
  const buttons = state.players.map(player => {
    const unavailable = Object.entries(draftVote).some(([otherSlot, selected]) => otherSlot !== slot && selected === player);
    const selected = draftVote[slot] === player;
    return `
      <button data-pick-slot="${slot}" data-pick-player="${escapeHtml(player)}" class="${selected ? 'selected' : ''}" ${unavailable ? 'disabled' : ''}>
        <span>${escapeHtml(player)}</span>${playerBadges(player)}
      </button>
    `;
  }).join('');

  return `<div><h3>${label}</h3><div class="grid">${buttons}</div></div>`;
}

function renderSavedVote(vote, index) {
  const first = vote.three || vote.p3;
  const second = vote.two || vote.p2;
  const third = vote.one || vote.p1;
  return `
    <div class="vote">
      <span>#${index + 1} ${escapeHtml(vote.voter || 'Anonymous')}: 3 ${escapeHtml(first)}, 2 ${escapeHtml(second)}, 1 ${escapeHtml(third)}</span>
      <button class="danger" data-delete-vote="${vote.id}">Delete</button>
    </div>
  `;
}

function renderResults() {
  const rows = withPlaces(scoreVotes(state.votes, state.players));
  const podium = rows
    .filter(row => row.points > 0 && row.place <= 3)
    .map(row => `
      <div class="place p${row.place}">
        <b>${row.place === 1 ? 'First' : row.place === 2 ? 'Second' : 'Third'} place</b>
        <span>${escapeHtml(row.name)}</span>
        <strong>${row.points} pts</strong>
      </div>
    `).join('');

  return pageShell(`
    <section class="card">
      <h2>Results</h2>
      <div class="podium">${podium || '<p class="hint">Save votes to build the podium.</p>'}</div>
      <h3>Leaderboard</h3>
      ${renderLeaderboard(rows)}
      <button class="wide" data-screen="voting">Back to Voting</button>
      <button class="danger wide" id="newMatch">New Match</button>
    </section>
  `);
}

function renderLeaderboard(rows) {
  const placedRows = rows[0]?.place ? rows : withPlaces(rows);
  return `
    <ol class="leader">
      ${placedRows.map(row => `
        <li>
          <span>#${row.place} ${escapeHtml(row.name)}</span>
          <b>${row.points} pts</b>
          <small>${row.firsts} first, ${row.seconds} second, ${row.thirds} third</small>
        </li>
      `).join('')}
    </ol>
  `;
}

function renderStatLeaderboard(rows, label) {
  if (!rows.length) return '<p class="hint">No saved stats yet.</p>';
  return `
    <ol class="leader">
      ${rows.map((row, index) => `
        <li>
          <span>#${index + 1} ${escapeHtml(row.name)}</span>
          <b>${row.count} ${label}</b>
        </li>
      `).join('')}
    </ol>
  `;
}

function renderRecords() {
  const allPlayers = [...new Set([...DEFAULT_PLAYERS, ...state.players, ...state.savedGames.flatMap(game => game.players || [])])];
  const seasonRows = withPlaces(scoreVotes(state.savedGames.flatMap(game => game.votes || []), allPlayers));
  const goalRows = sumStat(state.savedGames, 'goals');
  const assistRows = sumStat(state.savedGames, 'assists');
  const games = state.savedGames.length
    ? state.savedGames.map(renderSavedGame).join('')
    : '<p>No completed games saved yet.</p>';

  return pageShell(`
    <section class="card">
      <h2>Saved games & season totals</h2>
      <p class="hint">Spreadsheet upload for historical outcomes is reserved for a future import screen; this version stores records so previous games can be added later.</p>
      <h3>Season voting tally</h3>
      ${renderLeaderboard(seasonRows)}
      <h3>Overall goal scorers</h3>
      ${renderStatLeaderboard(goalRows, 'goals')}
      <h3>Overall assists</h3>
      ${renderStatLeaderboard(assistRows, 'assists')}
      <h3>Saved games</h3>
      ${games}
    </section>
  `);
}

function renderSavedGame(game) {
  return `
    <details>
      <summary>${escapeHtml(game.matchName)} — ${new Date(game.date).toLocaleDateString()} (${(game.votes || []).length} votes)</summary>
      <button class="danger wide" data-delete-game="${game.id}">Delete saved game</button>
      ${renderLeaderboard(withPlaces(scoreVotes(game.votes || [], game.players || DEFAULT_PLAYERS)))}
    </details>
  `;
}

function startNewMatch() {
  if (!confirm('Start a new match? Current votes will be saved to records and cleared.')) return;
  const savedGames = saveCurrentMatchToRecords();
  state = { ...freshState(), savedGames };
  draftVote = { three: '', two: '', one: '' };
  voterName = '';
  errorMessage = '';
  persist();
  render();
}

function addPlayer() {
  const input = document.querySelector('#newPlayer');
  const player = input.value.trim();
  if (!player) return;
  if (state.players.some(existing => existing.toLowerCase() === player.toLowerCase())) {
    errorMessage = 'That player is already listed.';
    render();
    return;
  }
  errorMessage = '';
  updateState({ players: [...state.players, player] });
}

function editPlayer(oldName) {
  const newName = prompt('Edit player name', oldName)?.trim();
  if (!newName || newName === oldName) return;
  if (state.players.some(player => player !== oldName && player.toLowerCase() === newName.toLowerCase())) {
    errorMessage = 'That player is already listed.';
    render();
    return;
  }

  const renameKey = values => {
    const next = { ...values };
    if (Object.prototype.hasOwnProperty.call(next, oldName)) {
      next[newName] = next[oldName];
      delete next[oldName];
    }
    return next;
  };

  updateState({
    players: state.players.map(player => player === oldName ? newName : player),
    goals: renameKey(state.goals),
    assists: renameKey(state.assists),
    votes: state.votes.map(vote => ({
      ...vote,
      three: (vote.three || vote.p3) === oldName ? newName : vote.three || vote.p3,
      two: (vote.two || vote.p2) === oldName ? newName : vote.two || vote.p2,
      one: (vote.one || vote.p1) === oldName ? newName : vote.one || vote.p1,
    })),
  });
}

function removePlayer(player) {
  if (state.votes.some(vote => [vote.three || vote.p3, vote.two || vote.p2, vote.one || vote.p1].includes(player))) {
    errorMessage = 'Delete votes for this player before removing them.';
    render();
    return;
  }
  const goals = { ...state.goals };
  const assists = { ...state.assists };
  delete goals[player];
  delete assists[player];
  updateState({ players: state.players.filter(name => name !== player), goals, assists });
}

function updateStat(player, type, delta) {
  updateState({
    [type]: {
      ...state[type],
      [player]: Math.max(0, countFor(player, type) + Number(delta)),
    },
  });
}

function saveVote() {
  const selections = Object.values(draftVote);
  if (selections.some(selection => !selection) || new Set(selections).size !== 3) {
    errorMessage = 'Choose three different players before saving.';
    render();
    return;
  }
  const vote = { id: uid(), voter: voterName.trim(), ...draftVote };
  draftVote = { three: '', two: '', one: '' };
  voterName = '';
  errorMessage = '';
  updateState({ votes: [...state.votes, vote] });
}

function deleteSavedGame(id) {
  if (!confirm('Delete this saved game from records and season tallies?')) return;
  updateState({ savedGames: state.savedGames.filter(game => game.id !== id) });
}

function handleInput(event) {
  if (event.target.id === 'matchName') {
    state.matchName = event.target.value;
    persist();
  }
  if (event.target.id === 'voterName') {
    voterName = event.target.value;
  }
}

function handleClick(event) {
  const button = event.target.closest('button');
  if (!button) return;

  if (button.dataset.screen) {
    errorMessage = '';
    updateState({ screen: button.dataset.screen });
  } else if (button.id === 'resetMatch' || button.id === 'newMatch') {
    startNewMatch();
  } else if (button.id === 'startVoting') {
    if (state.players.length < 3) {
      errorMessage = 'Add at least three players before voting.';
      render();
      return;
    }
    updateState({ screen: 'voting' });
  } else if (button.id === 'addPlayer') {
    addPlayer();
  } else if (button.dataset.editPlayer) {
    editPlayer(button.dataset.editPlayer);
  } else if (button.dataset.removePlayer) {
    removePlayer(button.dataset.removePlayer);
  } else if (button.dataset.stat) {
    updateStat(button.dataset.statPlayer, button.dataset.stat, button.dataset.delta);
  } else if (button.dataset.pickSlot) {
    draftVote = {
      ...draftVote,
      [button.dataset.pickSlot]: draftVote[button.dataset.pickSlot] === button.dataset.pickPlayer ? '' : button.dataset.pickPlayer,
    };
    render();
  } else if (button.id === 'saveVote') {
    saveVote();
  } else if (button.dataset.deleteVote) {
    updateState({ votes: state.votes.filter(vote => vote.id !== button.dataset.deleteVote) });
  } else if (button.dataset.deleteGame) {
    deleteSavedGame(button.dataset.deleteGame);
  }
}

function render() {
  const screens = {
    setup: renderSetup,
    voting: renderVoting,
    results: renderResults,
    records: renderRecords,
  };
  app.innerHTML = (screens[state.screen] || renderSetup)();
}

document.addEventListener('input', handleInput);
document.addEventListener('click', handleClick);
render();
