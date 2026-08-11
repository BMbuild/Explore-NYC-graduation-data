# SchoolLens MVP

This workspace contains a first version of the SchoolLens MVP, a static web application to explore NYC borough graduation rates from public data.

## What is included

- `index.html` — the main SchoolLens interface
- `styles.css` — visual styling for the MVP
- `script.js` — client-side logic for filtering, charting, and displaying the data
- `data/borough-graduation-rates.json` — filtered borough graduation data used by the interface
- `borough_graduation_rates_4year_june.png` — generated chart image from the current dataset

## How to run

Open `index.html` in a browser, or serve the folder with a simple local server for correct JSON loading. For example:

```bash
cd /Users/pursuit/L1/WK-5/2001-2019_Cohort_Graduation_Results__Excel_Files_
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Notes

- The MVP is intentionally simple and focused on exploration.
- Data is shown for borough-level graduation rates using 4-year June cohort results.
- SchoolLens does not explain causes; it highlights where differences appear and where further investigation may be helpful.
