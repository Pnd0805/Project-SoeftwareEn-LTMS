# Organizer browser evidence

HTTP fixtures only, not a live backend. `checks.json` records 37 layout captures, six interaction/runtime cases and three consequential-action gates. The PNGs include both themes and desktop/narrow layouts.

Start the real-mode frontend, with all API traffic intercepted by the runner:

```sh
VITE_USE_MOCK=false VITE_API_BASE_URL=/api/v1 npm run dev -- --host 127.0.0.1 --port 5176 --strictPort
```

Then run with an existing external Playwright installation (no app dependency added):

```sh
NODE_PATH=/tmp/ltms-ticket1-browser/node_modules node docs/superpowers/notes/ticket-05/check-browser.cjs
```

Set `LTMS_QA_ORIGIN` and `LTMS_QA_BROWSER` to override the frontend origin and Chromium executable. Screenshots/check records are written beside the runner.

- [Review popup](review-start-1440-light.png)
- [Registrations](registrations-1440-dark.png)
- [Referees](referees-1440-light.png)
- [Blocked Publish](blocked-publish.png)
- [Mobile request](request-390-light.png)
