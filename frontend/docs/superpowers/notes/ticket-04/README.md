# Ticket 04 rendered evidence

Browser-only HTTP fixtures exercise the existing real-mode hooks/adapters. These captures are demonstration data, not a live backend or customer data.

- `checks.json`: equal-frame measurements, no-overflow checks, local filters/highlighting, native keyboard/button scrolling, registration recovery and popup footer bounds.
- `mock-checks.json`: all three legacy Bracket formats; the double draw exists only in an isolated browser context.
- `check-browser.cjs`: reproducible real-mode fixture runner. Requires a separately installed Playwright module and Chromium; neither is a new app dependency.

Start Vite from frontend with `VITE_USE_MOCK=false VITE_API_BASE_URL=/api/v1 npm run dev -- --host 127.0.0.1 --port 5176 --strictPort`. In another terminal, run `NODE_PATH=/path/to/playwright/node_modules LTMS_QA_BROWSER=/path/to/chromium node docs/superpowers/notes/ticket-04/check-browser.cjs`. Set `LTMS_QA_ORIGIN` if using another port. Every API request is intercepted; do not use this runner as proof of live backend integration.

The final screenshots cover 1280×800, 1440×900 and 390×844 in dark/light themes. Additional captures cover Dashboard, Leaderboard, Community, Announcements, long content, Guest and denied Schedule access.
