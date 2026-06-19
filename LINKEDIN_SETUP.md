# LinkedIn API Setup Guide
## For AutoGen Studio — 15-Day Gen AI Campaign

---

## Option A: LinkedIn Developer API (Fully Automated)

### Step 1 — Create a LinkedIn App

1. Go to: https://www.linkedin.com/developers/apps
2. Click **"Create App"**
3. Fill in:
   - **App Name**: `GenAI Campaign Scheduler` (or any name)
   - **LinkedIn Page**: Use your personal profile page URL
   - **App Logo**: Upload any image
4. Click **"Create App"**

### Step 2 — Request the Right Permission

1. In your app dashboard, go to **"Products"** tab
2. Find **"Share on LinkedIn"** → Click **"Request Access"**
3. Wait for approval (usually instant or within a few hours)

### Step 3 — Get Your Access Token

1. Go to **"Auth"** tab in your app dashboard
2. Under **OAuth 2.0 tools**, click **"OAuth 2.0 scopes"**
3. Select: `w_member_social`, `r_liteprofile`
4. Click **"Get Access Token"**
5. Copy the token (it's valid for 60 days)

### Step 4 — Add Token to Your .env File

Open your `.env` file and add:

```env
LINKEDIN_ACCESS_TOKEN=AQX...your_token_here...
```

### Step 5 — Install node-cron

```bash
npm install node-cron
```

### Step 6 — Run the Scheduler

```bash
# Preview all 15 posts:
node linkedin_scheduler.js --preview

# Test: Post Day 1 right now:
node linkedin_scheduler.js --now

# Start auto-scheduler (posts daily at 8:30 AM):
node linkedin_scheduler.js
```

---

## Option B: Manual Copy-Paste (Zero Setup)

No API needed! Use the visual dashboard:

1. Open `linkedin_dashboard.html` in your browser
2. Each day, click the post card → **"Copy Text"**
3. Paste into LinkedIn's post composer
4. Hit post!

The dashboard shows you exactly which post is "Up Next" each day.

---

## Option C: Buffer (Free SaaS Scheduler)

1. Go to https://buffer.com → Create free account
2. Connect your LinkedIn profile
3. Create 15 posts scheduled 1 day apart starting tomorrow
4. Paste each post from `linkedin_posts.json`
5. Buffer handles the rest automatically

---

## Token Renewal

LinkedIn access tokens expire after **60 days**. Since your campaign is 15 days, you won't need to renew.

If you want to run future campaigns:
1. Go back to the LinkedIn Developer portal
2. Re-generate the token
3. Update `.env`

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `401 Unauthorized` | Token expired or wrong — regenerate |
| `403 Forbidden` | `w_member_social` permission not approved yet |
| `LINKEDIN_ACCESS_TOKEN not set` | Check your `.env` file |
| Post not appearing on LinkedIn | Check LinkedIn app is not in "Dev Mode" only |

---

## Campaign Schedule

| Day | Date | Theme |
|-----|------|-------|
| 1 | June 20 | The Spark — Why I started Gen AI |
| 2 | June 21 | Prompt Engineering deep dive |
| 3 | June 22 | LLMs explained without jargon |
| 4 | June 23 | My first real Gemini API call |
| 5 | June 24 | Multi-Agent AI Systems |
| 6 | June 25 | Project teaser 👀 |
| 7 | June 26 | **AutoGen Studio Launch** 🚀 |
| 8 | June 27 | How agents talk to each other |
| 9 | June 28 | HuggingFace + open source models |
| 10 | June 29 | The hardest bug I fixed |
| 11 | June 30 | Gemini 2.0 Flash insights |
| 12 | July 1 | Startup Validator demo |
| 13 | July 2 | 10 lessons from 90 days |
| 14 | July 3 | Future of AI agents |
| 15 | July 4 | Gratitude + Open to Work 🎯 |

---

*Good luck! This campaign is going to get you noticed.* 🚀
