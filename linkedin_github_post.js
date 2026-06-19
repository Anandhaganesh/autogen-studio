// linkedin_github_post.js
// ─────────────────────────────────────────────────────
// Runs on GitHub Actions cloud servers every day at 8:30 AM IST.
// NO laptop needed. NO terminal needed.
// GitHub's free servers post to LinkedIn automatically.
// ─────────────────────────────────────────────────────

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const POSTS_FILE = path.join(__dirname, 'linkedin_posts.json');
const LOG_FILE   = path.join(__dirname, 'campaign_log.txt');

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n', 'utf-8');
}

async function getUserId(token) {
  const res = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`getUserId: ${res.status} ${await res.text()}`);
  return (await res.json()).sub;
}

async function publishPost(token, authorId, text) {
  const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0'
    },
    body: JSON.stringify({
      author: `urn:li:person:${authorId}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text },
          shareMediaCategory: 'NONE'
        }
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
      }
    })
  });
  if (!res.ok) throw new Error(`publishPost: ${res.status} ${await res.text()}`);
  return (await res.json()).id;
}

async function main() {
  log('=== GitHub Actions Auto-Post Triggered ===');

  const token = process.env.LINKEDIN_ACCESS_TOKEN;
  if (!token) {
    log('ERROR: LINKEDIN_ACCESS_TOKEN secret not set in GitHub repository.');
    log('Go to: github.com → Your Repo → Settings → Secrets → Actions → New Secret');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(POSTS_FILE, 'utf-8'));

  // Find the next pending post
  const nextPost = data.posts.find(p => p.status === 'pending');

  if (!nextPost) {
    log('🎉 All 15 posts have been published! Campaign complete!');
    process.exit(0);
  }

  log(`Posting Day ${nextPost.day}: "${nextPost.theme}"`);

  try {
    const userId = await getUserId(token);
    const postId = await publishPost(token, userId, nextPost.content);

    log(`✅ SUCCESS: Day ${nextPost.day} posted! LinkedIn Post ID: ${postId}`);

    // Mark this post as sent
    data.posts = data.posts.map(p =>
      p.day === nextPost.day
        ? { ...p, status: 'sent', sentAt: new Date().toISOString(), linkedinPostId: postId }
        : p
    );

    fs.writeFileSync(POSTS_FILE, JSON.stringify(data, null, 2));
    log(`📝 linkedin_posts.json updated — Day ${nextPost.day} marked as sent.`);

    const remaining = data.posts.filter(p => p.status === 'pending').length;
    log(`📊 ${remaining} posts remaining in campaign.`);

    if (remaining === 0) {
      log('🎉 CAMPAIGN COMPLETE! All 15 posts published. Congratulations!');
    } else {
      const nextUp = data.posts.find(p => p.status === 'pending');
      log(`⏭️  Next up: Day ${nextUp.day} — "${nextUp.theme}" (tomorrow at 8:30 AM IST)`);
    }

  } catch (err) {
    log(`❌ ERROR: ${err.message}`);
    process.exit(1);
  }
}

main();
