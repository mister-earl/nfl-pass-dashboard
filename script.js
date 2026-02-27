let allPlays = [];
let chart = null;

// ===== LOAD DATA =====
async function loadData() {
  try {
    const res = await fetch('data.json');
    allPlays = await res.json();
    setupListeners();
    applyFilters();
  } catch (e) {
    document.getElementById('plays-list').innerHTML =
      '<p class="no-results">Error loading data. Make sure data.json is in the same folder.</p>';
  }
}

// ===== FILTER LOGIC =====
function getFilters() {
  return {
    coverage: document.getElementById('coverage').value,
    down: document.getElementById('down').value,
    distance: document.getElementById('distance').value,
    formation: document.getElementById('formation').value,
    redzone: document.getElementById('btn-redzone').dataset.active === 'true',
    playaction: document.getElementById('btn-playaction').dataset.active === 'true',
  };
}

function matchesFilter(play, f) {
  if (f.coverage !== 'all' && play.coverage_type !== f.coverage) return false;
  if (f.down !== 'all' && play.down !== parseInt(f.down)) return false;
  if (f.formation !== 'all' && play.offense_formation !== f.formation) return false;
  if (f.redzone && !play.is_red_zone) return false;
  if (f.playaction && !play.play_action) return false;

  if (f.distance !== 'all') {
    const len = play.pass_length;
    if (f.distance === 'short' && !(len >= 1 && len <= 10)) return false;
    if (f.distance === 'medium' && !(len > 10 && len <= 20)) return false;
    if (f.distance === 'deep' && !(len > 20)) return false;
  }

  return true;
}

function applyFilters() {
  const f = getFilters();
  const filtered = allPlays.filter(p => matchesFilter(p, f));
  renderStats(filtered);
  renderChart(filtered);
  renderPlays(filtered);
}

// ===== STATS =====
function renderStats(plays) {
  const total = plays.length;
  const completions = plays.filter(p => p.pass_result === 'C').length;
  const compPct = total > 0 ? ((completions / total) * 100).toFixed(1) : '--';
  const avgYards = total > 0
    ? (plays.reduce((s, p) => s + p.yards_gained, 0) / total).toFixed(1)
    : '--';
  const avgLength = total > 0
    ? (plays.reduce((s, p) => s + p.pass_length, 0) / total).toFixed(1)
    : '--';
  const epaPlays = plays.filter(p => p.epa !== null);
  const avgEpa = epaPlays.length > 0
    ? (epaPlays.reduce((s, p) => s + p.epa, 0) / epaPlays.length).toFixed(2)
    : '--';

  document.getElementById('stat-plays').textContent = total.toLocaleString();
  document.getElementById('stat-comp').textContent = total > 0 ? compPct + '%' : '--%';
  document.getElementById('stat-yards').textContent = total > 0 ? avgYards + ' yds' : '-- yds';
  document.getElementById('stat-length').textContent = total > 0 ? avgLength + ' yds' : '-- yds';
  document.getElementById('stat-epa').textContent = avgEpa;
}

// ===== CHART =====
function renderChart(plays) {
  const complete = plays.filter(p => p.pass_result === 'C').length;
  const incomplete = plays.filter(p => p.pass_result === 'I').length;
  const interception = plays.filter(p => p.pass_result === 'IN').length;

  const ctx = document.getElementById('resultsChart').getContext('2d');

  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Complete', 'Incomplete', 'Interception'],
      datasets: [{
        data: [complete, incomplete, interception],
        backgroundColor: [
          'rgba(0, 212, 255, 0.8)',
          'rgba(123, 47, 255, 0.8)',
          'rgba(255, 68, 102, 0.8)'
        ],
        borderColor: '#0b0e1a',
        borderWidth: 3,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#c8cce0',
            padding: 20,
            font: { size: 13 }
          }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
              return ` ${ctx.label}: ${ctx.parsed.toLocaleString()} plays (${pct}%)`;
            }
          }
        }
      },
      cutout: '65%'
    }
  });
}

// ===== PLAYS LIST =====
function renderPlays(plays) {
  const list = document.getElementById('plays-list');
  const label = document.getElementById('plays-count-label');

  if (plays.length === 0) {
    label.textContent = '';
    list.innerHTML = '<p class="no-results">No plays match your filters. Try adjusting them.</p>';
    return;
  }

  const sample = plays.slice(0, 20);
  label.textContent = `(showing 20 of ${plays.length.toLocaleString()})`;

  const resultLabel = { C: 'Complete', I: 'Incomplete', IN: 'Interception' };

  list.innerHTML = sample.map(p => {
    const result = p.pass_result || 'I';
    const badge = `<span class="result-badge result-${result}">${resultLabel[result] || result}</span>`;
    const coverage = p.coverage_type.replace(/_/g, ' ').replace('ZONE', '').replace('MAN', '').trim();
    return `
      <div class="play-item">
        <div class="play-meta">
          ${badge}
          <span><strong>${p.possession_team}</strong></span>
          <span>Down: <strong>${p.down}</strong></span>
          <span>Coverage: <strong>${coverage}</strong></span>
          <span>Length: <strong>${Math.round(p.pass_length)} yds</strong></span>
          ${p.is_red_zone ? '<span>🔴 Red Zone</span>' : ''}
          ${p.play_action ? '<span>🎭 Play Action</span>' : ''}
        </div>
        <p class="play-description">${p.play_description}</p>
      </div>
    `;
  }).join('');
}

// ===== EVENT LISTENERS =====
function setupListeners() {
  ['coverage', 'down', 'distance', 'formation'].forEach(id => {
    document.getElementById(id).addEventListener('change', applyFilters);
  });

  ['btn-redzone', 'btn-playaction'].forEach(id => {
    document.getElementById(id).addEventListener('click', (e) => {
      const btn = e.currentTarget;
      btn.dataset.active = btn.dataset.active === 'true' ? 'false' : 'true';
      applyFilters();
    });
  });

  document.getElementById('reset').addEventListener('click', () => {
    document.getElementById('coverage').value = 'all';
    document.getElementById('down').value = 'all';
    document.getElementById('distance').value = 'all';
    document.getElementById('formation').value = 'all';
    document.getElementById('btn-redzone').dataset.active = 'false';
    document.getElementById('btn-playaction').dataset.active = 'false';
    applyFilters();
  });
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', loadData);
