---
name: webapp-testing
description: "Test and debug local web apps in a browser: verify UI behaviour, capture screenshots, read console errors. Use when a change touches HTML, CSS, client-side JS, or the served console."
license: Complete terms in LICENSE.txt
---

# Web Application Testing

Verify what a web app actually does in a browser, instead of assuming it does.

> Adapted from Anthropic's `webapp-testing` skill (Apache-2.0, see `LICENSE.txt`).
> The upstream skill drives Python Playwright. **This environment has no Python
> Playwright** — it has Node Playwright 1.64.x and a Playwright MCP server.
> The methodology is unchanged; the mechanics are local.

## Which browser tool to use

Two options. Pick by what you need.

| Need | Tool |
|---|---|
| Interactive inspection: navigate, snapshot the DOM, click, type, screenshot, read console | **Playwright MCP tools** (`browser_navigate`, `browser_snapshot`, `browser_click`, `browser_type`, `browser_console_messages`, `browser_take_screenshot`, `browser_evaluate`) |
| Repeatable assertions over many cases | **Node Playwright** — `npx playwright` 1.64.x is installed |

The MCP server is the default. Use Node Playwright only when a test must be
repeatable, run in CI, or assert on data the MCP cannot reach directly.

**Never write Python Playwright here.** `import playwright` fails — Python
Playwright is not installed. A Python script is dead weight, not a test.

## Decision tree

```
Is the target a static HTML file?
  ├─ Yes → Read it, identify selectors, then drive the browser.
  └─ No (dynamic app)
      ├─ Is the server already running?
      │    ├─ No  → Start it, wait for the port to answer, then drive the browser.
      │    └─ Yes → Reconnaissance-then-action:
      │             1. Navigate
      │             2. Wait for the page to settle (see "Waiting" below)
      │             3. Snapshot the DOM to discover real selectors
      │             4. Act using the discovered selectors
      └─ Assert the outcome, not just the click
```

## Waiting — the single most common source of false failures

A page that renders is not a page that has finished working.

- **DOM snapshot**: the MCP's `browser_snapshot` returns the accessibility
  tree; wait for the element you need to appear in it rather than sleeping.
- **Node Playwright**: prefer `page.waitForLoadState('networkidle')` before
  asserting, and `locator.waitFor()` over `waitForTimeout()`.
- **Never** assert against a fixed sleep. If a page genuinely has no signal
  to wait on, that is a finding about the page, not a reason to sleep longer.

## Console errors are results, not noise

Read the console after every interaction, not only when something looks wrong.
A silent `console.error` is a defect the user will see. `browser_console_messages`
is the cheapest signal available and it is often the only one that reveals a
broken handler.

Check for:
- uncaught exceptions and rejected promises
- failed network requests (404 on an asset is still a broken page)
- React/Vue "key" and "hydration" warnings
- errors that only fire on a state the default view never reaches

## Server readiness

Before driving the browser, confirm the server actually answers:

```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:<port>/
```

A non-2xx/3xx means the server is down or the route is wrong — fix that
before blaming the frontend. Do not debug the DOM against a dead server.

For the Virtual Office, the server runs as a systemd unit:

```bash
systemctl is-active virtual-office.service
```

## Screenshot discipline

Take a screenshot when you need to show *what the page looks like* — a layout
regression, a broken asset, a wrong colour. Do not screenshot to prove to
yourself that an element exists; use the DOM snapshot for that. Screenshots
are large, and images are expensive in context.

Name screenshots for what they show (`header-typography.png`), write them to
a scratch path, and delete them when the task is done unless the user asked
to keep them.

## Reading elements

Prefer, in order:

1. **Accessibility/DOM snapshot** — gives roles, labels and text without
   guessing at class names.
2. **`browser_evaluate`** — read a computed style or a piece of state when
   the snapshot does not surface it.
3. **Reading the source** — when the markup is static and small. This is the
   cheapest option for a static page.

Do not build selectors by reading CSS class names out of a stylesheet and
hoping they survive. Discover them from the live DOM.

## Reporting

Report what you observed, not what you intended:

- what you navigated to, and the URL that actually served
- what you did, and what the page did in response
- console errors verbatim (they are the most useful artifact you have)
- a screenshot path, if you took one

Never report "the UI works" from a successful screenshot alone. If you did not
exercise the error state, the empty state, and the responsive layout, say
which ones you did not test.
