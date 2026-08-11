const dataUrl = './data/borough-graduation-rates.json';
const boroughSelect = document.getElementById('borough-select');
const yearSelect = document.getElementById('year-select');
const cohortSelect = document.getElementById('cohort-select');
const insightCopy = document.getElementById('insight-copy');
const chartSvg = document.getElementById('trend-chart');
const feedbackForm = document.getElementById('feedback-form');
const feedbackComments = document.getElementById('feedback-comments');
const feedbackWordCount = document.getElementById('feedback-word-count');
const feedbackMessage = document.getElementById('feedback-message');
let allData = [];

function buildOptions(items, select, label) {
  select.innerHTML = '';
  const defaultOption = document.createElement('option');
  defaultOption.value = 'all';
  defaultOption.textContent = `All ${label}`;
  select.appendChild(defaultOption);

  items.forEach(item => {
    const option = document.createElement('option');
    option.value = item;
    option.textContent = item;
    select.appendChild(option);
  });
}

function getFilters() {
  return {
    borough: boroughSelect.value,
    year: yearSelect.value,
    cohort: cohortSelect.value,
  };
}

function filterData() {
  const { borough, year, cohort } = getFilters();
  let filtered = allData;
  if (borough !== 'all') filtered = filtered.filter(item => item.borough === borough);
  if (year !== 'all') filtered = filtered.filter(item => String(item.year) === year);
  if (cohort !== 'all') filtered = filtered.filter(item => item.cohort === cohort);
  return filtered;
}

function getChartData() {
  const { borough, cohort } = getFilters();
  let filtered = allData;
  if (borough !== 'all') filtered = filtered.filter(item => item.borough === borough);
  if (cohort !== 'all') filtered = filtered.filter(item => item.cohort === cohort);
  return filtered;
}

function summarizeInsight(filtered) {
  if (!filtered.length) {
    return 'No data matches the selected combination. Try a broader borough, year, or cohort selection.';
  }

  const latestYear = Math.max(...filtered.map(item => item.year));
  const latest = filtered.filter(item => item.year === latestYear);
  const sortedByGrad = [...latest].sort((a, b) => b.graduationRate - a.graduationRate);
  const best = sortedByGrad[0];
  const worst = sortedByGrad[sortedByGrad.length - 1];

  if (boroughSelect.value !== 'all' && yearSelect.value !== 'all' && cohortSelect.value !== 'all') {
    const entry = filtered[0];
    return `In ${entry.borough} for ${entry.year} (${entry.cohort}), the graduation rate is ${entry.graduationRate.toFixed(1)}% while the dropout rate is ${entry.dropoutRate.toFixed(1)}%.`;
  }

  if (boroughSelect.value !== 'all') {
    const boroughRows = filtered.sort((a, b) => a.year - b.year);
    const delta = boroughRows[boroughRows.length - 1].graduationRate - boroughRows[0].graduationRate;
    const direction = delta >= 0 ? 'increased' : 'decreased';
    return `For ${boroughSelect.value}, the graduation rate has ${direction} ${Math.abs(delta).toFixed(1)} points over the available years in the selected data.`;
  }

  if (yearSelect.value !== 'all') {
    return `In ${yearSelect.value}, borough graduation rates range from ${worst.graduationRate.toFixed(1)}% (${worst.borough}) to ${best.graduationRate.toFixed(1)}% (${best.borough}).`;
  }

  return `Across the available data, the highest recent borough graduation rate is ${best.graduationRate.toFixed(1)}% (${best.borough}) and the lowest is ${worst.graduationRate.toFixed(1)}% (${worst.borough}), highlighting meaningful variation among boroughs.`;
}

function drawChart(filtered) {
  const width = 920;
  const height = 420;
  const margin = { top: 32, right: 28, bottom: 48, left: 60 };
  chartSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  chartSvg.innerHTML = '';

  if (!filtered.length) {
    chartSvg.innerHTML = '<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="18" fill="#475569">No data available for this selection.</text>';
    return;
  }

  const years = Array.from(new Set(filtered.map(item => item.year))).sort((a, b) => a - b);
  const series = groupBy(filtered, 'borough');
  const gradValues = filtered.map(item => item.graduationRate);
  const yMax = Math.min(100, Math.max(...gradValues) * 1.08);
  const yMin = 0;

  const xStep = years.length > 1 ? (width - margin.left - margin.right) / (years.length - 1) : 0;
  const xForYear = year => margin.left + years.indexOf(year) * xStep;
  const yForValue = value => height - margin.bottom - ((value - yMin) / (yMax - yMin || 1)) * (height - margin.top - margin.bottom);

  chartSvg.innerHTML += `<rect x="0" y="0" width="${width}" height="${height}" fill="#f8fbff" rx="20" />`;

  [0, 20, 40, 60, 80, 100].filter(value => value <= yMax).forEach(value => {
    const y = yForValue(value);
    chartSvg.innerHTML += `<line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" stroke="#e2e8f0" stroke-width="1" />`;
    chartSvg.innerHTML += `<text x="${margin.left - 12}" y="${y + 4}" text-anchor="end" font-size="12" fill="#475569">${value}%</text>`;
  });

  years.forEach(year => {
    const x = xForYear(year);
    chartSvg.innerHTML += `<line x1="${x}" y1="${margin.top}" x2="${x}" y2="${height - margin.bottom}" stroke="#e9eef6" stroke-width="1" />`;
    chartSvg.innerHTML += `<text x="${x}" y="${height - margin.bottom + 28}" text-anchor="middle" font-size="12" fill="#475569">${year}</text>`;
  });

  Object.keys(series).forEach((borough, index) => {
    const sorted = series[borough].sort((a, b) => a.year - b.year);
    const opacity = boroughSelect.value === 'all' ? 0.85 : borough === boroughSelect.value ? 1 : 0.35;
    const stroke = boroughSelect.value === borough ? '#1d4ed8' : '#2563eb';

    const path = sorted.map(point => `${xForYear(point.year)},${yForValue(point.graduationRate)}`).join(' ');
    chartSvg.innerHTML += `<polyline fill="none" stroke="${stroke}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${path}" opacity="${opacity}" />`;
    sorted.forEach(point => {
      chartSvg.innerHTML += `<circle cx="${xForYear(point.year)}" cy="${yForValue(point.graduationRate)}" r="5" fill="${stroke}" stroke="#ffffff" stroke-width="2" opacity="${opacity}" />`;
    });
  });

  const { year } = getFilters();
  if (year !== 'all') {
    const highlighted = filtered.filter(item => String(item.year) === year);
    highlighted.forEach(point => {
      const x = xForYear(point.year);
      const y = yForValue(point.graduationRate);
      chartSvg.innerHTML += `<circle cx="${x}" cy="${y}" r="8" fill="#f97316" stroke="#ffffff" stroke-width="3" />`;
      chartSvg.innerHTML += `<text x="${x}" y="${y - 14}" text-anchor="middle" font-size="12" fill="#0f172a">${point.graduationRate.toFixed(1)}%</text>`;
    });
  }

  chartSvg.innerHTML += `<text x="${margin.left}" y="${margin.top - 8}" font-size="14" font-weight="700" fill="#0f172a">Graduation rate by borough</text>`;
}

function groupBy(array, key) {
  return array.reduce((acc, item) => {
    if (!acc[item[key]]) acc[item[key]] = [];
    acc[item[key]].push(item);
    return acc;
  }, {});
}

function countWords(text) {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .length;
}

function setFeedbackMessage(message, type = 'success') {
  feedbackMessage.textContent = message;
  feedbackMessage.classList.toggle('error', type === 'error');
  feedbackMessage.classList.toggle('success', type === 'success');
}

function updateFeedbackWordCount() {
  const count = countWords(feedbackComments.value);
  feedbackWordCount.textContent = count;
  if (count > 300) {
    setFeedbackMessage('Your comment is too long. Please keep it under 300 words.', 'error');
  } else if (feedbackMessage.classList.contains('error')) {
    setFeedbackMessage('', 'success');
  }
}

function refreshView() {
  const filtered = filterData();
  insightCopy.textContent = summarizeInsight(filtered);
  const chartData = getChartData();
  drawChart(chartData);
}

function initFeedbackForm() {
  if (!feedbackForm) return;

  updateFeedbackWordCount();

  feedbackComments.addEventListener('input', updateFeedbackWordCount);

  feedbackForm.addEventListener('submit', event => {
    event.preventDefault();
    const usefulRating = document.querySelector('input[name="useful-rating"]:checked');
    const experienceRating = document.querySelector('input[name="experience-rating"]:checked');
    const comment = feedbackComments.value;
    const wordCount = countWords(comment);

    if (!usefulRating || !experienceRating) {
      setFeedbackMessage('Please answer both satisfaction questions before submitting.', 'error');
      return;
    }

    if (wordCount > 300) {
      setFeedbackMessage('Please shorten your comment to 300 words or fewer.', 'error');
      return;
    }

    setFeedbackMessage('Thank you. Your feedback has been received.', 'success');
    feedbackForm.reset();
    updateFeedbackWordCount();
    console.log('SchoolLens feedback submitted', {
      usefulRating: usefulRating.value,
      experienceRating: experienceRating.value,
      comment: comment.trim(),
      words: wordCount,
    });
  });
}

function initApp() {
  fetch(dataUrl)
    .then(response => response.json())
    .then(data => {
      allData = data.entries;
      const boroughs = Array.from(new Set(allData.map(item => item.borough))).sort();
      const years = Array.from(new Set(allData.map(item => item.year))).sort();
      const cohorts = Array.from(new Set(allData.map(item => item.cohort))).sort();

      buildOptions(boroughs, boroughSelect, 'Borough');
      buildOptions(years, yearSelect, 'Years');
      buildOptions(cohorts, cohortSelect, 'Cohort Types');

      boroughSelect.addEventListener('change', refreshView);
      yearSelect.addEventListener('change', refreshView);
      cohortSelect.addEventListener('change', refreshView);
      refreshView();
      initFeedbackForm();
    })
    .catch(error => {
      chartSvg.innerHTML = `<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="18" fill="#ef4444">Unable to load data.</text>`;
      insightCopy.textContent = 'Unable to load insights at this time.';
      console.error(error);
    });
}

initApp();
