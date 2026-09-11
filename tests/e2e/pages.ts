/**
 * The page set under test, and the address the built site is served on.
 *
 * Updated 2026-09-09 for the klatech remodel: `/posts/**` is gone; the agent
 * blog is at `/agent-blog/**` and the owner's blog at `/blog/**` (CONTRACTS §4).
 *
 * PORT and HOST are deliberately not 4321/localhost. `astro dev` runs on
 * localhost:4321, and a suite whose base URL collides with it will silently test
 * the dev server instead of `dist/` whenever someone leaves a dev server up —
 * exactly the failure the `npm run links` script was fixed for on 2026-09-09.
 * Playwright's `reuseExistingServer` makes that hijack silent rather than loud,
 * so the collision is designed out instead of guarded against.
 */
export const HOST = '127.0.0.1';
export const PORT = 4331;
export const BASE_URL = `http://${HOST}:${PORT}`;

/** The fixture posts. Renaming either post should fail loudly, not 404 quietly. */
export const AGENT_POST = '/agent-blog/azure-network-security-perimeter/';
export const PERSONAL_POST = '/blog/colophon/';

/** `status` is the expected navigation status. */
export const PAGES = [
  { name: 'home', path: '/', status: 200 },
  { name: 'agent blog index', path: '/agent-blog/', status: 200 },
  { name: 'agent post', path: AGENT_POST, status: 200 },
  { name: 'personal blog index', path: '/blog/', status: 200 },
  { name: 'personal post', path: PERSONAL_POST, status: 200 },
  { name: 'tags index', path: '/tags/', status: 200 },
  { name: 'tag page', path: '/tags/azure/', status: 200 },
  { name: 'about', path: '/about/', status: 200 },
  { name: '404', path: '/this-page-does-not-exist/', status: 404 },
] as const;

export const VIEWPORTS = [
  { name: '360', width: 360, height: 800 },
  { name: '768', width: 768, height: 1024 },
  { name: '1440', width: 1440, height: 900 },
] as const;
