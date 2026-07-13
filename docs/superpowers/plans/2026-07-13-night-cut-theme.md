# NIGHT//CUT Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete `/nightfall/` NIGHT//CUT theme, preserve identical personal content across both themes, and support section-preserving navigation between the independent runtimes.

**Architecture:** Keep `/` and `/nightfall/` as separate Vite HTML entries with separate DOM, CSS, WebGL renderers, and lifecycles. Share only typed personal content plus a small route/hash contract; NIGHT//CUT renders semantic DOM first and treats WebGL/audio as disposable enhancement layers.

**Tech Stack:** TypeScript 5.6, Vite 6 multi-page build, Three.js 0.170, Vitest + jsdom, Playwright, Web Audio API, semantic HTML/CSS.

## Global Constraints

- Route `/` remains the abyss theme; route `/nightfall/` is the new theme.
- The themes read the same personal content and use stable lowercase kebab-case content IDs.
- NIGHT//CUT must not import `src/main.ts`, `src/scene.ts`, or `src/style.css`.
- Colors are Night `#07060B`, Surface `#0E0C17`, Ice Cyan `#67EFFF`, Electric Violet `#8C49FF`, Impact White `#F4F2FF`, and Muted Ink `#A7A3B5`.
- Default audio state is off; no audio graph is created before explicit user activation.
- Scroll unlocks every section; pointer/touch attacks are optional presentation only.
- Desktop and mobile use identical choreography while DPR, particles, refraction resolution, and trail samples may adapt.
- Reduced motion removes shake, parallax, fast trails, and continuous particles; no highlight may flash three times per second.
- WebGL/audio failure must not remove content, navigation, or theme switching.
- Do not use copyrighted characters, logos, music, dialogue, or effects from the visual reference.

---

### Task 1: Test Harness, Multi-Page Build, and Shared Content Contract

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `src/content/site.ts`
- Modify: `src/config.ts`
- Modify: `src/content/memories.ts`
- Create: `src/theme-navigation.ts`
- Test: `src/content/content.test.ts`
- Test: `src/theme-navigation.test.ts`

**Interfaces:**
- Produces: `Memory.id: string`, `site`, `ThemeId`, `contentHash()`, `parseContentHash()`, `themeHref()`.
- Consumes: current `site` values and all current memory story text without per-theme copies.

- [ ] **Step 1: Install the test tools and add scripts**

Set scripts to:

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test",
  "build": "tsc --noEmit && vite build"
}
```

Install `vitest`, `jsdom`, `@playwright/test`, and `axe-core` as dev dependencies.

- [ ] **Step 2: Write failing shared-contract tests**

```ts
import { describe, expect, it } from 'vitest'
import { memories } from './memories'

describe('shared content', () => {
  it('has unique stable ids', () => {
    const ids = memories.map((memory) => memory.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every((id) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))).toBe(true)
  })
})
```

```ts
import { expect, it } from 'vitest'
import { contentHash, parseContentHash, themeHref } from './theme-navigation'

it('round trips memory hashes across themes', () => {
  const hash = contentHash({ kind: 'memory', id: 'first-loved-job' })
  expect(hash).toBe('#memory/first-loved-job')
  expect(parseContentHash(hash)).toEqual({ kind: 'memory', id: 'first-loved-job' })
  expect(themeHref('nightfall', hash)).toBe('/nightfall/#memory/first-loved-job')
})
```

- [ ] **Step 3: Run tests and verify the missing-contract failure**

Run: `npm test -- src/content/content.test.ts src/theme-navigation.test.ts`

Expected: FAIL because `Memory.id` and `theme-navigation.ts` do not exist.

- [ ] **Step 4: Implement the shared contract**

Use these public types and functions:

```ts
export type ContentLocation =
  | { kind: 'top' }
  | { kind: 'now' }
  | { kind: 'memory'; id: string }
  | { kind: 'end' }

export type ThemeId = 'abyss' | 'nightfall'

export const themeRoutes: Record<ThemeId, string> = {
  abyss: '/',
  nightfall: '/nightfall/',
}

export function contentHash(location: ContentLocation): string
export function parseContentHash(hash: string): ContentLocation | null
export function themeHref(theme: ThemeId, hash: string): string
```

Add a unique stable `id` to every existing memory. Move the shared `site` object to `src/content/site.ts`; keep `src/config.ts` as a compatibility re-export so the abyss runtime remains readable.

- [ ] **Step 5: Configure Vite and tests**

Use both HTML entries:

```ts
export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: { abyss: 'index.html', nightfall: 'nightfall/index.html' },
    },
  },
})
```

Configure Vitest for jsdom and Playwright to run `npm run dev -- --host 127.0.0.1` on an unused local port.

- [ ] **Step 6: Run unit tests and build**

Run: `npm test && npm run build`

Expected: all shared-contract tests PASS; build may still fail only because the planned `nightfall/index.html` entry is not created until Task 3. Temporarily add a semantic stub entry in this task so the build is green.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vite.config.ts vitest.config.ts playwright.config.ts src/content src/config.ts src/theme-navigation.ts nightfall/index.html
git commit -m "feat: add shared theme content contract"
```

### Task 2: Section-Preserving Theme Switch in the Abyss Runtime

**Files:**
- Modify: `index.html`
- Modify: `src/main.ts`
- Modify: `src/style.css`
- Test: `src/theme-navigation.test.ts`

**Interfaces:**
- Consumes: `Memory.id`, `ContentLocation`, `themeHref('nightfall', hash)`.
- Produces: `data-content-id` on abyss memory buttons and a theme-switch anchor whose hash tracks the nearest content section.

- [ ] **Step 1: Extend the navigation test**

```ts
it('rejects malformed and unknown-shaped hashes', () => {
  expect(parseContentHash('#memory/UPPER_CASE')).toBeNull()
  expect(parseContentHash('#anything')).toBeNull()
})
```

- [ ] **Step 2: Add the semantic switch control**

Add to `index.html`:

```html
<a class="theme-switch" id="theme-switch" href="/nightfall/" aria-label="切换到断夜主题">
  <span aria-hidden="true">NIGHT//CUT</span>
  <span>切换主题</span>
</a>
```

- [ ] **Step 3: Track the closest shared content location**

Set each memory button's `dataset.contentId = m.id`. During the existing scroll update, compute `top`, `now`, nearest `memory`, or `end`, then update only the switch anchor:

```ts
const switchLink = $('theme-switch') as HTMLAnchorElement
let activeLocation: ContentLocation = { kind: 'top' }

function syncThemeHref() {
  switchLink.href = themeHref('nightfall', contentHash(activeLocation))
}
```

When the page loads with a valid hash, scroll or focus the matching section after `layout()`; clear invalid hashes with `history.replaceState(null, '', location.pathname + location.search)`.

- [ ] **Step 4: Style the switch without changing the abyss visual system**

Use a small fixed outline control at top right, keep existing `--lure` focus treatment, and ensure it does not overlap `.surfacing` by moving surfacing below it.

- [ ] **Step 5: Verify**

Run: `npm test && npm run build`

Expected: PASS. Manual check: `/#memory/first-loved-job` focuses that memory and the link targets `/nightfall/#memory/first-loved-job`.

- [ ] **Step 6: Commit**

```bash
git add index.html src/main.ts src/style.css src/theme-navigation.test.ts
git commit -m "feat: add section-aware theme switching"
```

### Task 3: NIGHT//CUT Semantic Experience, Timeline, and Quality Policy

**Files:**
- Replace: `nightfall/index.html`
- Create: `src/nightfall/main.ts`
- Create: `src/nightfall/style.css`
- Create: `src/nightfall/model.ts`
- Create: `src/nightfall/content-adapter.ts`
- Create: `src/nightfall/timeline.ts`
- Create: `src/nightfall/quality.ts`
- Test: `src/nightfall/content-adapter.test.ts`
- Test: `src/nightfall/timeline.test.ts`
- Test: `src/nightfall/quality.test.ts`

**Interfaces:**
- Produces: `BattleChapter`, `BattleState`, `createBattleChapters()`, `BattleTimeline`, `QualityPolicy`.
- Consumes: shared `site`, `memories`, and parsed content hashes.

- [ ] **Step 1: Write failing model tests**

```ts
it('maps every shared memory without rewriting story text', () => {
  const chapters = createBattleChapters(site, memories)
  const memoryChapters = chapters.filter((chapter) => chapter.kind === 'memory')
  expect(memoryChapters).toHaveLength(memories.length)
  expect(memoryChapters[0]?.story).toEqual(memories[0]?.story)
})

it('cancels stale impact when the active chapter changes', () => {
  const timeline = new BattleTimeline(3)
  const first = timeline.activate(0)
  const second = timeline.activate(2)
  expect(first.signal.aborted).toBe(true)
  expect(second.signal.aborted).toBe(false)
})

it('degrades samples but never choreography', () => {
  const policy = new QualityPolicy('high')
  const before = policy.current
  policy.recordFrames(Array(45).fill(25))
  expect(policy.current.trailSamples).toBeLessThan(before.trailSamples)
  expect(policy.current.choreography).toBe(before.choreography)
})
```

- [ ] **Step 2: Run tests and verify failures**

Run: `npm test -- src/nightfall`

Expected: FAIL because the NIGHT//CUT model modules do not exist.

- [ ] **Step 3: Implement models and state transitions**

Use:

```ts
export type BattleState = 'idle' | 'armed' | 'impact' | 'reading' | 'leaving'

export type BattleChapter = {
  key: string
  kind: 'now' | 'memory' | 'end'
  label: string
  year?: number
  title: string
  story: readonly string[]
  side: 'left' | 'right'
}
```

`BattleTimeline.activate(index)` returns a fresh `AbortController`, aborts the previous controller, and exposes state changes to the app through a callback.

- [ ] **Step 4: Build semantic HTML and full CSS layout**

The HTML contains a skip link, decorative canvas, non-WebGL fallback layer, opening hero, chapter container, HUD, sound toggle, theme switch, live status, and end section. Generate alternating `<article>` elements from `BattleChapter`; stories are real paragraphs in DOM at startup.

Implement the approved colors, four-shot opening, alternating tactical panels, fixed HUD, mobile-equivalent composition, focus styles, reduced-motion media query, CSS fallback slashes, and local flash-area limits.

- [ ] **Step 5: Implement hash entry and opening behavior**

No hash: run auto shots through `armed` at 2.8 seconds, wait for scroll/click/swipe/Enter/Space, then complete impact and show content within 7.2 seconds. Valid hash: skip to a <=400 ms lock animation and focus the matching chapter. Invalid hash: clear it and start at top.

- [ ] **Step 6: Run tests and build**

Run: `npm test -- src/nightfall && npm run build`

Expected: PASS with both `dist/index.html` and `dist/nightfall/index.html` present.

- [ ] **Step 7: Commit**

```bash
git add nightfall/index.html src/nightfall
git commit -m "feat: build NIGHT CUT semantic battle timeline"
```

### Task 4: WebGL Combat Renderer and Cancellable Choreography

**Files:**
- Create: `src/nightfall/renderer.ts`
- Create: `src/nightfall/choreography.ts`
- Create: `src/nightfall/gesture.ts`
- Modify: `src/nightfall/main.ts`
- Test: `src/nightfall/choreography.test.ts`
- Test: `src/nightfall/gesture.test.ts`

**Interfaces:**
- Produces: `CombatRenderer`, `CombatCommand`, `Choreography`, `GestureLayer`.
- Consumes: `QualityPolicy.current`, `BattleTimeline` abort signals, semantic chapter positions.

- [ ] **Step 1: Write failing command and gesture tests**

```ts
it('does not emit a completed impact after abort', async () => {
  const controller = new AbortController()
  const events: string[] = []
  const run = playImpact({ signal: controller.signal, onPhase: (p) => events.push(p) })
  controller.abort()
  await run
  expect(events).not.toContain('complete')
})

it('normalizes a swipe into an optional slash command', () => {
  expect(toSlash({ x: 10, y: 10 }, { x: 110, y: 40 })).toMatchObject({ active: true })
  expect(toSlash({ x: 10, y: 10 }, { x: 12, y: 12 })).toMatchObject({ active: false })
})
```

- [ ] **Step 2: Implement renderer layers**

Create one transparent Three.js renderer with:

- low-frequency procedural background plane;
- lock rings and directional battlefield lines;
- pooled slash quads with white cores and cyan/violet halos;
- pooled shard points;
- two render targets for short afterimages/refraction;
- a final shader pass with chromatic offset limited to the WebGL canvas.

Expose only:

```ts
export type CombatRenderer = {
  resize(): void
  setQuality(quality: QualitySettings): void
  setReading(reading: boolean): void
  lockAt(x: number, y: number): void
  slash(command: SlashCommand): void
  impact(command: ImpactCommand): void
  render(time: number): void
  dispose(): void
}
```

- [ ] **Step 3: Implement cancellable choreography**

Use `requestAnimationFrame` and abort signals. Opening, chapter impact, active gesture, and ending must be separate named sequences; reading pauses background motion and removes shake/refraction.

- [ ] **Step 4: Integrate gestures without blocking scroll**

Pointer/touch listeners use passive events except during a confirmed horizontal/diagonal attack. A short click emits a point slash. Enter/Space advances the armed opening without requiring pointer simulation.

- [ ] **Step 5: Add WebGL context-loss fallback**

If renderer creation throws or `webglcontextlost` fires, call `dispose()`, add `.is-css-fallback`, and leave timeline/DOM/theme switching active.

- [ ] **Step 6: Verify**

Run: `npm test -- src/nightfall && npm run build`

Expected: PASS. Manual check: fast forward/back scroll never queues old impacts; text remains undistorted.

- [ ] **Step 7: Commit**

```bash
git add src/nightfall
git commit -m "feat: add NIGHT CUT combat renderer"
```

### Task 5: Lazy Audio, Lifecycle Cleanup, and Visibility Handling

**Files:**
- Create: `scripts/generate-nightfall-audio.mjs`
- Create: `public/nightfall/audio/ambience.wav`
- Create: `public/nightfall/audio/slash.wav`
- Create: `public/nightfall/audio/impact.wav`
- Create: `public/nightfall/audio/daybreak.wav`
- Create: `src/nightfall/audio.ts`
- Create: `src/nightfall/lifecycle.ts`
- Modify: `src/nightfall/main.ts`
- Test: `src/nightfall/audio.test.ts`
- Test: `src/nightfall/lifecycle.test.ts`

**Interfaces:**
- Produces: `AudioDirector`, `DisposableScope`.
- Consumes: choreography phase events and document visibility.

- [ ] **Step 1: Write failing lazy-audio test**

```ts
it('does not construct an AudioContext before enable', async () => {
  const createContext = vi.fn(() => fakeContext)
  const audio = new AudioDirector(createContext)
  expect(createContext).not.toHaveBeenCalled()
  await audio.enable()
  expect(createContext).toHaveBeenCalledOnce()
})
```

- [ ] **Step 2: Generate original audio assets**

Create a deterministic Node script that writes 44.1 kHz mono PCM WAV files: filtered low-frequency noise for ambience, a 90 ms descending noise sweep for slash, a 180 ms sine/noise hit for impact, and a 1.8 s three-note sine chord for daybreak. Use a fixed PRNG seed so generated binaries are reproducible and contain no third-party samples.

Run: `node scripts/generate-nightfall-audio.mjs`

Expected: four non-empty WAV files under `public/nightfall/audio/`.

- [ ] **Step 3: Implement AudioDirector**

Create the audio graph only in `enable()`. After explicit activation, fetch and decode the four `/nightfall/audio/*.wav` files, then expose `playSlash()`, `playImpact()`, `playDaybreak()`, `setAmbience(active)`, `disable()`, and `dispose()`. `disable()` immediately disconnects gain output; `dispose()` stops sources and closes the context. Any fetch, decode, or context rejection resolves to `false` and leaves UI off.

- [ ] **Step 4: Implement DisposableScope**

```ts
export class DisposableScope {
  add(dispose: () => void): void
  listen<K extends keyof WindowEventMap>(target: Window, type: K, listener: (event: WindowEventMap[K]) => void, options?: AddEventListenerOptions): void
  dispose(): void
}
```

Use it for every listener, observer, animation cancellation, renderer, gesture layer, and audio object.

- [ ] **Step 5: Handle visibility and theme navigation**

`document.hidden` pauses renderer and ambience; restore redraws current state. The theme switch remains normal navigation and does not persist audio state. Register `pagehide` to dispose the complete app.

- [ ] **Step 6: Verify and commit**

Run: `npm test -- src/nightfall && npm run build`

Expected: PASS; no AudioContext exists before the toggle is activated.

```bash
git add scripts/generate-nightfall-audio.mjs public/nightfall/audio src/nightfall
git commit -m "feat: add NIGHT CUT audio and cleanup"
```

### Task 6: End-to-End, Accessibility, Performance, and Completion Audit

**Files:**
- Create: `tests/nightfall.spec.ts`
- Create: `tests/theme-switch.spec.ts`
- Create: `tests/accessibility.spec.ts`
- Modify: `src/nightfall/style.css`
- Modify: `src/nightfall/main.ts`
- Modify: `src/main.ts`
- Modify: `README.md` only if it already exists; otherwise document commands in the design plan rather than creating a marketing README.

**Interfaces:**
- Consumes: completed routes and DOM contracts.
- Produces: executable acceptance evidence for every numbered requirement in the design spec.

- [ ] **Step 1: Write E2E acceptance tests**

```ts
test('shows real content after the armed opening receives input', async ({ page }) => {
  await page.goto('/nightfall/')
  await page.waitForTimeout(2900)
  await expect(page.locator('body')).toHaveAttribute('data-opening', 'armed')
  await page.mouse.wheel(0, 120)
  await expect(page.getByRole('heading', { name: '此刻' })).toBeVisible()
})

test('preserves the memory id across themes', async ({ page }) => {
  await page.goto('/#memory/first-loved-job')
  await page.getByRole('link', { name: '切换到断夜主题' }).click()
  await expect(page).toHaveURL(/\/nightfall\/#memory\/first-loved-job$/)
  await expect(page.getByRole('heading', { name: '第一份热爱的工作' })).toBeVisible()
})
```

Add cases for keyboard-only opening, sound default-off, invalid hashes, reduced motion, CSS fallback class, mobile viewport, complete chapter count, and return navigation.

- [ ] **Step 2: Add automated accessibility checks**

Inject `axe-core` in both routes and assert zero serious/critical violations. Also assert one visible focus indicator, decorative canvas `aria-hidden="true"`, named switches, and no hidden story text in the accessibility tree.

- [ ] **Step 3: Add performance and cleanup assertions**

Expose a development-only diagnostics object reporting renderer count, registered listener count, current quality, and active audio contexts. Revisit both themes 20 times in Playwright and assert counts return to baseline. Record active-animation frame samples and assert the quality policy degrades after sustained frames over 20 ms.

- [ ] **Step 4: Run the full verification matrix**

Run:

```bash
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Expected: all unit and E2E tests PASS; both HTML entries build; axe reports no serious/critical findings.

- [ ] **Step 5: Manual rendered audit**

Verify at desktop 1440×900 and mobile 390×844:

- the same four opening shots and chapter order;
- cyan/violet/white palette with no abyss visual tokens;
- input-triggered impact, optional attacks, reading calm, and dawn ending;
- theme switch preserves `#now`, every `#memory/<id>`, and `#end`;
- sound remains off until explicitly enabled;
- reduced motion removes shake/trails/continuous particles;
- WebGL-disabled route still exposes all content and navigation.

- [ ] **Step 6: Audit every design-spec acceptance condition**

Map each item in section 12.4 of `docs/superpowers/specs/2026-07-13-night-cut-theme-design.md` to a passing test, build artifact, or rendered inspection. Any missing evidence is implementation work, not a documentation exception.

- [ ] **Step 7: Commit**

```bash
git add tests src package.json package-lock.json playwright.config.ts
git commit -m "test: verify NIGHT CUT theme experience"
```
