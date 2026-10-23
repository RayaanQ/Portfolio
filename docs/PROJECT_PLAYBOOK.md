# Project playbook: getting the most out of every repo

Recruiters spend about 30 seconds on a GitHub profile. This is a repo-by-repo checklist so each project backs up the portfolio instead of undercutting it.
Items are ordered by impact.

## 🔴 Fix first

| Repo | Issue | Fix |
|---|---|---|
| **Movie-Recommendation-System** | A TMDB API key is hard-coded in `app.py`. | Revoke it in TMDB settings, read it from `st.secrets["TMDB_API_KEY"]` or an env var, and keep `.streamlit/secrets.toml` out of git. |
| **AI-Web-Page-Summarizer** | The repo has only a README, no code, yet it's a headline résumé project. | Push the `backend/` (FastAPI) and `extension/` folders, plus a `docker-compose.yml`. Add a 20-second demo GIF at the top of the README. |
| **SMS-Spam-Classifier** | README only. | Push the notebook and `app.py`, or archive the repo. |
| **Tourist-Places-Management-System** | README only. | Push the Flask code or archive the repo. |
| **Linguistai** | An empty README. | Write a description or archive the repo. |
| **Hospital-Management-System** | About 2,000 committed `node_modules` files. | `git rm -r --cached backend/node_modules`, add a `.gitignore`, commit. |
| **JurisTrack** | `__pycache__/` is committed. | Same fix: add a Python `.gitignore` and untrack it. |
| **Movie-Recommendation-System** | `similarity.pkl` is loaded but not in the repo, so the app crashes on clone. | Rebuild it at startup from `movie_list.pkl`, or host it on Hugging Face and download it on first run. |

## 🟡 Make projects *live* (all free)

A link someone can click beats any README. Free hosts that fit each stack:

| Project | Host | Notes |
|---|---|---|
| Community Crisis Predictor | **Streamlit Community Cloud** | Run it with the `--synthetic` data path so it needs no API keys. The static HTML report can also go on GitHub Pages. |
| Movie Recommender, SMS Spam Classifier | **Streamlit Community Cloud** | Connect the repo, set secrets, done. |
| JurisTrack | **Hugging Face Spaces** (Docker) or **Render** free tier for FastAPI; **GitHub Pages** for the React build | The rule-based fallback means the demo works without a Gemini key. |
| AI Web Page Summarizer | **Hugging Face Spaces** (Docker) for the API | Publish the extension as a `.zip` release so people can load it unpacked. |
| LingoLeap, Fitness Tracker | **Vercel** (Next.js / React) + **MongoDB Atlas** free tier + **Render** for Node | |

Once a project is live, add the URL to the repo's **About → Website** field and to its card in `index.html`. The portfolio picks up repo metadata automatically.

## 🟢 Polish every repo (10 minutes each)

1. **About panel**: one-line description, website link, and 3–6 topics (`rag`, `langchain`, `fastapi`, `llm`, `pytorch`…). The portfolio's archive table reads these through the GitHub API.
2. **README header**: project name, one sentence on the problem, a screenshot or GIF, then "Run locally" in three commands or fewer.
3. **Rename for clarity**: `Misarticulation-Project` → `LingoLeap`. GitHub redirects the old URL automatically.
4. **Pin six repos** on your profile: Community Crisis Predictor, AI Web Page Summarizer, JurisTrack, LingoLeap, Portfolio, Movie Recommender.
5. **Profile README**: create a public repo named exactly `RayaanQ`. Its `README.md` shows at the top of your profile. Put a two-line intro there and link to the portfolio.
6. **Community Crisis Predictor is a fork.** Commits to a fork don't count on your contribution graph unless they're merged upstream. If it's mainly your work, consider *Settings → Leave fork network* (or ask GitHub Support to detach it), and say in the README what you built.
7. **Greenory has no public repo.** It's on your résumé, so if you can share the code, publishing it adds a sixth live case study.

## Adding a project to the portfolio

- **Featured** (the big interactive cards): copy an `<article class="project">` block in `index.html`, change the text, and either reuse an existing `data-viz` animation or add a new one in `vizzes` in `assets/js/main.js`.
- **Archive** (the table): add a `<tr>` with `data-repo="<exact repo name>"` and `data-tags="ai | fullstack | cs"`.
