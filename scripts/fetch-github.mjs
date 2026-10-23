// Fetches public repo metadata for the archive table and writes data/github.json.
// Runs in the GitHub Pages workflow; fails soft so a GitHub API hiccup never blocks a deploy.
import { writeFile, readFile } from 'node:fs/promises';

const USER = process.env.GH_USER || 'RayaanQ';
const OUT = new URL('../data/github.json', import.meta.url);
const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'portfolio-sync' };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

try {
  const res = await fetch(`https://api.github.com/users/${USER}/repos?per_page=100&type=owner&sort=pushed`, { headers });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const list = await res.json();
  const repos = {};
  for (const r of list) {
    repos[r.name] = {
      description: r.description,
      language: r.language,
      stars: r.stargazers_count,
      forks: r.forks_count,
      homepage: r.homepage || null,
      topics: r.topics || [],
      pushed_at: r.pushed_at,
      url: r.html_url,
    };
  }
  const data = { generated_at: new Date().toISOString(), user: USER, count: list.length, repos };
  await writeFile(OUT, JSON.stringify(data, null, 2) + '\n');
  console.log(`Wrote ${list.length} repos to data/github.json`);
} catch (err) {
  const existing = await readFile(OUT, 'utf8').catch(() => null);
  console.warn(`::warning::Could not refresh GitHub data (${err.message}); keeping ${existing ? 'existing' : 'empty'} data.`);
}
