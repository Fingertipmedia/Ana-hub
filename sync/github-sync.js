#!/usr/bin/env node
/**
 * GitHub Sync Poller for Ana Hub
 * Polls the sync repository for events and forwards them to the local backend.
 */

import { Octokit } from 'octokit';
import { config } from 'dotenv';
import { resolve } from 'path';
import fs from 'fs';
import http from 'http';

config();

// Load config
const configDir = resolve(process.env.CONFIG_DIR || '../config');
function loadJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(`${configDir}/${file}`, 'utf8'));
  } catch (e) {
    return {};
  }
}

const SYNC = loadJSON('sync.json', { pollInterval: 60, repo: '' });
const SECRETS_PATH = `${configDir}/secrets.json`;
let SECRETS = {};
try {
  SECRETS = JSON.parse(fs.readFileSync(SECRETS_PATH, 'utf8'));
} catch (e) {
  console.error('secrets.json required'); process.exit(1);
}

const octokit = new Octokit({ auth: SECRETS.github.token });
const BACKEND_URL = 'http://127.0.0.1:3000/api/sync/apply';

async function poll() {
  try {
    const { data: issues } = await octokit.rest.issues.listForRepo({
      owner: SECRETS.github.owner || 'yourorg',
      repo: SECRETS.github.repo || SYNC.repo,
      state: 'open',
      labels: 'type:sync',
      per_page: 50,
      sort: 'updated',
      direction: 'desc'
    });

    for (const issue of issues) {
      try {
        const payloadStr = issue.body;
        if (!payloadStr) continue;
        const payload = JSON.parse(payloadStr);

        // Forward to local backend
        await new Promise((resolve, reject) => {
          const req = http.request(BACKEND_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
              if (res.statusCode === 200) resolve();
              else reject(new Error(`Backend responded ${res.statusCode}: ${data}`));
            });
          });
          req.on('error', reject);
          req.write(JSON.stringify(payload));
          req.end();
        });

        // Close issue after successful apply
        await octokit.rest.issues.update({
          owner: SECRETS.github.owner || 'yourorg',
          repo: SECRETS.github.repo || SYNC.repo,
          issue_number: issue.number,
          state: 'closed'
        });
      } catch (err) {
        console.error('Failed to sync issue', issue.number, err.message);
        // Leave issue open for retry
      }
    }
  } catch (err) {
    console.error('GitHub poll error:', err.message);
  }
}

const intervalMs = (SYNC.pollInterval || 60) * 60 * 1000;
setInterval(poll, intervalMs);
// Run once at startup after short delay
setTimeout(poll, 10000);

console.log(`GitHub sync started; polling every ${SYNC.pollInterval || 60} minutes`);