const boroughDataUrl = './data/borough-graduation-rates.json';
const schoolDataUrl = './data/school-graduation-rates.json';
const boroughSelect = document.getElementById('borough-select');
const yearSelect = document.getElementById('year-select');
const cohortSelect = document.getElementById('cohort-select');
const insightCopy = document.getElementById('insight-copy');
const chartSvg = document.getElementById('trend-chart');
const schoolChart = document.getElementById('school-chart');
const schoolCount = document.getElementById('school-count');
const schoolChartDescription = document.getElementById('school-chart-description');
const mapElement = document.getElementById('borough-map');
const feedbackForm = document.getElementById('feedback-form');
const feedbackComments = document.getElementById('feedback-comments');
const feedbackWordCount = document.getElementById('feedback-word-count');
const feedbackMessage = document.getElementById('feedback-message');

const boroughColors = {
  Manhattan: '#16a34a', Bronx: '#e11d48', Brooklyn: '#7c3aed', Queens: '#d97706', 'Staten Island': '#2563eb',
};
let boroughData = [];
let schoolData = [];
let boroughMap;
let boroughMapLayer;
const boroughGeoJsonUrl = 'https://data.cityofnewyork.us/api/v3/views/gthc-hcne/query.geojson?$limit=10';

function buildOptions(items, select, label) {
  select.innerHTML = `<option value="all">All ${label}</option>`;
  items.forEach(item => select.add(new Option(item, item)));
}

function filters() {
  return { borough: boroughSelect.value, year: yearSelect.value, cohort: cohortSelect.value };
}

function filterRows(rows, includeCohort = true) {
  const { borough, year, cohort } = filters();
  return rows.filter(row =>
    (borough === 'all' || row.borough === borough) &&
    (year === 'all' || String(row.year) === year) &&
    (!includeCohort || cohort === 'all' || row.cohort === cohort)
  );
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

function summarizeInsight(rows) {
  if (!rows.length) return 'No borough data matches these filters. Try a broader selection.';
  const latestYear = Math.max(...rows.map(row => row.year));
  const latest = rows.filter(row => row.year === latestYear).sort((a, b) => b.graduationRate - a.graduationRate);
  const best = latest[0];
  const lowest = latest.at(-1);
  if (boroughSelect.value !== 'all') {
    const ordered = [...rows].sort((a, b) => a.year - b.year);
    const change = ordered.at(-1).graduationRate - ordered[0].graduationRate;
    return `${boroughSelect.value}'s graduation rate ${change >= 0 ? 'increased' : 'decreased'} by ${Math.abs(change).toFixed(1)} percentage points across the selected years.`;
  }
  return `In ${latestYear}, ${best.borough} had the highest borough graduation rate (${best.graduationRate.toFixed(1)}%), while ${lowest.borough} had the lowest (${lowest.graduationRate.toFixed(1)}%).`;
}

function groupBy(rows, key) {
  return rows.reduce((groups, row) => ((groups[row[key]] ??= []).push(row), groups), {});
}

function drawTrend(rows) {
  const width = 920, height = 420, margin = { top: 42, right: 28, bottom: 50, left: 58 };
  chartSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  if (!rows.length) { chartSvg.innerHTML = '<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="18" fill="#475569">No data available for this selection.</text>'; return; }
  const years = [...new Set(rows.map(row => row.year))].sort((a, b) => a - b);
  const x = year => margin.left + (years.indexOf(year) * (width - margin.left - margin.right) / Math.max(1, years.length - 1));
  const y = rate => height - margin.bottom - rate / 100 * (height - margin.top - margin.bottom);
  let markup = '<rect width="920" height="420" rx="18" fill="#f8fafc"/>';
  [0, 20, 40, 60, 80, 100].forEach(rate => {
    markup += `<line x1="${margin.left}" y1="${y(rate)}" x2="${width - margin.right}" y2="${y(rate)}" stroke="#e2e8f0"/>`;
    markup += `<text x="${margin.left - 10}" y="${y(rate) + 4}" text-anchor="end" font-size="12" fill="#64748b">${rate}%</text>`;
  });
  years.forEach(year => markup += `<text x="${x(year)}" y="${height - 18}" text-anchor="middle" font-size="12" fill="#64748b">${year}</text>`);
  Object.entries(groupBy(rows, 'borough')).forEach(([borough, series]) => {
    const sorted = series.sort((a, b) => a.year - b.year);
    const points = sorted.map(point => `${x(point.year)},${y(point.graduationRate)}`).join(' ');
    const color = boroughColors[borough];
    markup += `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`;
    sorted.forEach(point => markup += `<circle cx="${x(point.year)}" cy="${y(point.graduationRate)}" r="4.5" fill="${color}" stroke="#fff" stroke-width="2"><title>${borough}, ${point.year}: ${point.graduationRate.toFixed(1)}%</title></circle>`);
  });
  const selectedYear = yearSelect.value;
  if (selectedYear !== 'all') {
    rows.filter(row => String(row.year) === selectedYear).forEach(point => {
      const color = boroughColors[point.borough];
      markup += `<circle cx="${x(point.year)}" cy="${y(point.graduationRate)}" r="8" fill="#fff" stroke="${color}" stroke-width="4"><title>Selected: ${point.borough}, ${point.year}: ${point.graduationRate.toFixed(1)}%</title></circle>`;
      markup += `<text x="${x(point.year)}" y="${y(point.graduationRate) - 15}" text-anchor="middle" font-size="12" font-weight="700" fill="${color}">${point.graduationRate.toFixed(1)}%</text>`;
    });
  }
  markup += '<text x="58" y="22" font-size="14" font-weight="700" fill="#0f172a">Four-year June graduation rate</text>';
  chartSvg.innerHTML = markup;
}

function drawSchoolChart(rows) {
  const { borough, year } = filters();
  schoolCount.textContent = rows.length.toLocaleString();
  const location = borough === 'all' ? 'the five boroughs' : borough;
  schoolChartDescription.textContent = `${rows.length.toLocaleString()} schools in ${location}${year === 'all' ? ', across all available cohort years.' : ` for the ${year} cohort.`}`;
  if (!rows.length) { schoolChart.innerHTML = '<p class="empty-state">No school records match this selection.</p>'; return; }
  const sorted = [...rows].sort((a, b) => b.graduationRate - a.graduationRate || a.school.localeCompare(b.school));
  schoolChart.innerHTML = sorted.map(row => `<article class="school-row" tabindex="0" role="listitem" style="--borough-color:${boroughColors[row.borough]}">
    <div class="school-label"><strong>${escapeHtml(row.school)}</strong><span>${escapeHtml(row.borough)} · ${row.dbn} · cohort ${row.cohortSize ?? '—'}</span></div>
    <div class="rate-track" aria-label="${escapeHtml(row.school)} graduation rate ${row.graduationRate}%"><span style="width:${row.graduationRate}%"></span></div>
    <strong class="rate-value">${row.graduationRate.toFixed(1)}%</strong>
  </article>`).join('');
}

function updateMap(rows) {
  if (!boroughMapLayer) return;
  const rates = Object.fromEntries(rows.map(row => [row.borough, row.graduationRate]));
  const activeBorough = boroughSelect.value;
  boroughMapLayer.eachLayer(layer => {
    const borough = layer.feature.properties.boroname;
    const rate = rates[borough];
    const isActive = activeBorough === 'all' || borough === activeBorough;
    layer.setStyle({ fillColor: boroughColors[borough] || '#94a3b8', fillOpacity: rate !== undefined && isActive ? .72 : .14, color: isActive ? '#ffffff' : '#cbd5e1', weight: isActive ? 2 : 1 });
    layer.unbindTooltip();
    layer.bindTooltip(`<strong>${borough}</strong><br>${rate === undefined ? 'No matching data' : `${rate.toFixed(1)}% graduation rate`}`, { sticky: true });
  });
}

function initMap() {
  if (!window.L || !mapElement) return;
  boroughMap = L.map(mapElement, { scrollWheelZoom: false, zoomControl: true }).setView([40.70, -73.94], 10);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; OpenStreetMap contributors' }).addTo(boroughMap);
  fetch(boroughGeoJsonUrl)
    .then(response => response.json())
    .then(geoJson => {
      boroughMapLayer = L.geoJSON(geoJson, {
        style: { color: '#ffffff', weight: 2, fillOpacity: .7 },
        onEachFeature: (feature, layer) => layer.on({ click: () => { boroughSelect.value = feature.properties.boroname; refreshView(); } }),
      }).addTo(boroughMap);
      boroughMap.fitBounds(boroughMapLayer.getBounds(), { padding: [18, 18] });
      updateMap(filterRows(boroughData));
    })
    .catch(() => { mapElement.innerHTML = '<p class="empty-state">The map could not load. Please check your internet connection and try again.</p>'; });
}

function refreshView() {
  const boroughRows = filterRows(boroughData);
  insightCopy.textContent = summarizeInsight(boroughRows);
  const { borough, cohort } = filters();
  const trendRows = boroughData.filter(row =>
    (borough === 'all' || row.borough === borough) &&
    (cohort === 'all' || row.cohort === cohort)
  );
  drawTrend(trendRows);
  drawSchoolChart(filterRows(schoolData, false));
  updateMap(boroughRows);
}

function countWords(text) { return text.trim().split(/\s+/).filter(Boolean).length; }
function setFeedbackMessage(message, type = 'success') { feedbackMessage.textContent = message; feedbackMessage.className = `feedback-message ${type}`; }
function initFeedbackForm() {
  feedbackComments.addEventListener('input', () => { feedbackWordCount.textContent = countWords(feedbackComments.value); });
  feedbackForm.addEventListener('submit', event => {
    event.preventDefault();
    const useful = document.querySelector('input[name="useful-rating"]:checked');
    const experience = document.querySelector('input[name="experience-rating"]:checked');
    if (!useful || !experience) return setFeedbackMessage('Please answer both satisfaction questions before submitting.', 'error');
    if (countWords(feedbackComments.value) > 300) return setFeedbackMessage('Please shorten your comment to 300 words or fewer.', 'error');
    setFeedbackMessage('Thank you. Your feedback has been received.'); feedbackForm.reset(); feedbackWordCount.textContent = '0';
  });
}

Promise.all([fetch(boroughDataUrl).then(response => response.json()), fetch(schoolDataUrl).then(response => response.json())])
  .then(([boroughs, schools]) => {
    boroughData = boroughs.entries; schoolData = schools.entries;
    buildOptions([...new Set(boroughData.map(row => row.borough))].sort(), boroughSelect, 'Boroughs');
    buildOptions([...new Set(schoolData.map(row => row.year))].sort((a, b) => a - b), yearSelect, 'Cohort Years');
    buildOptions([...new Set(boroughData.map(row => row.cohort))].sort(), cohortSelect, 'Cohort Types');
    [boroughSelect, yearSelect, cohortSelect].forEach(select => select.addEventListener('change', refreshView));
    refreshView(); initFeedbackForm();
    initMap();
  })
  .catch(error => { console.error(error); insightCopy.textContent = 'Unable to load graduation data at this time.'; schoolChart.innerHTML = '<p class="empty-state">Unable to load school-level data.</p>'; });
