#!/usr/bin/env node
/**
 * Seed a demo team + dummy APIs **through the PayloadX MCP server** (stdio → tools).
 *
 *   PAYLOADX_TOKEN=pxat_... \
 *   PAYLOADX_BASE_URL=https://payload-x-….run.app \
 *   node scripts/mcp-seed-demo.mjs
 */
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = join(__dirname, '..');
const STDIO = join(BACKEND_ROOT, 'src/mcp/stdio.js');

function loadTokenFromCursorMcp() {
  try {
    const raw = readFileSync(join(homedir(), '.cursor', 'mcp.json'), 'utf8');
    const cfg = JSON.parse(raw);
    const auth = cfg?.mcpServers?.payloadx?.headers?.Authorization || '';
    if (auth.startsWith('Bearer ')) return auth.slice(7);
  } catch {
    /* ignore */
  }
  return null;
}

const BASE = (
  process.env.PAYLOADX_BASE_URL || 'https://payload-x-884697093779.europe-west1.run.app'
).replace(/\/+$/, '');
const TOKEN = process.env.PAYLOADX_TOKEN || loadTokenFromCursorMcp();

if (!TOKEN) {
  console.error('Missing PAYLOADX_TOKEN');
  process.exit(1);
}

function parseToolText(result) {
  const text = (result?.content || [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('\n');
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text, isError: result?.isError };
  }
}

async function callTool(client, name, args = {}) {
  const result = await client.callTool({ name, arguments: args });
  const data = parseToolText(result);
  if (result.isError || data.error) {
    throw new Error(`${name}: ${data.error || data.raw || JSON.stringify(data)}`);
  }
  return data;
}

const FOLDERS = [
  {
    name: 'Auth',
    requests: [
      {
        name: 'Login',
        method: 'POST',
        url: '{{baseUrl}}/api/auth/login',
        bodyRaw: JSON.stringify({ email: 'demo@payloadx.dev', password: 'demo123' }, null, 2),
      },
      {
        name: 'Register',
        method: 'POST',
        url: '{{baseUrl}}/api/auth/register',
        bodyRaw: JSON.stringify(
          { name: 'Demo User', email: 'demo@payloadx.dev', password: 'demo123' },
          null,
          2
        ),
      },
      { name: 'Me', method: 'GET', url: '{{baseUrl}}/api/auth/me' },
      { name: 'Logout', method: 'POST', url: '{{baseUrl}}/api/auth/logout' },
    ],
  },
  {
    name: 'Users',
    requests: [
      { name: 'List users', method: 'GET', url: '{{baseUrl}}/api/users' },
      { name: 'Get user', method: 'GET', url: '{{baseUrl}}/api/users/1' },
      {
        name: 'Create user',
        method: 'POST',
        url: '{{baseUrl}}/api/users',
        bodyRaw: JSON.stringify({ name: 'Ada Lovelace', email: 'ada@example.com' }, null, 2),
      },
      {
        name: 'Update user',
        method: 'PUT',
        url: '{{baseUrl}}/api/users/1',
        bodyRaw: JSON.stringify({ name: 'Ada L.' }, null, 2),
      },
      { name: 'Delete user', method: 'DELETE', url: '{{baseUrl}}/api/users/1' },
    ],
  },
  {
    name: 'Posts',
    requests: [
      { name: 'List posts', method: 'GET', url: '{{baseUrl}}/api/posts' },
      { name: 'Get post', method: 'GET', url: '{{baseUrl}}/api/posts/1' },
      {
        name: 'Create post',
        method: 'POST',
        url: '{{baseUrl}}/api/posts',
        bodyRaw: JSON.stringify({ title: 'Hello PayloadX', body: 'Dummy post' }, null, 2),
      },
      {
        name: 'Patch post',
        method: 'PATCH',
        url: '{{baseUrl}}/api/posts/1',
        bodyRaw: JSON.stringify({ title: 'Updated' }, null, 2),
      },
      { name: 'Delete post', method: 'DELETE', url: '{{baseUrl}}/api/posts/1' },
    ],
  },
  {
    name: 'Health',
    requests: [
      { name: 'Health check', method: 'GET', url: '{{baseUrl}}/health' },
      {
        name: 'JSONPlaceholder todo',
        method: 'GET',
        url: 'https://jsonplaceholder.typicode.com/todos/1',
      },
      {
        name: 'JSONPlaceholder posts',
        method: 'GET',
        url: 'https://jsonplaceholder.typicode.com/posts?_limit=5',
      },
    ],
  },
];

const jsonHeaders = [
  { key: 'Content-Type', value: 'application/json', enabled: true },
  { key: 'Accept', value: 'application/json', enabled: true },
];

async function main() {
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const teamName = `PayloadX Demo ${stamp}`;

  console.log('MCP stdio →', STDIO);
  console.log('API base →', BASE);

  const transport = new StdioClientTransport({
    command: 'node',
    args: [STDIO],
    env: {
      ...process.env,
      PAYLOADX_TOKEN: TOKEN,
      PAYLOADX_BASE_URL: BASE,
    },
  });

  const client = new Client({ name: 'payloadx-seed', version: '1.0.0' });
  await client.connect(transport);

  try {
    const me = await callTool(client, 'whoami');
    console.log('whoami ok', me.user?.email || me.authenticated || '');

    const teamRes = await callTool(client, 'create_team', {
      name: teamName,
      description: 'Demo team seeded via PayloadX MCP',
    });
    const teamId = teamRes.team.id;
    console.log('create_team →', teamRes.team.name, teamId);

    const projectRes = await callTool(client, 'create_project', {
      teamId,
      name: 'Demo API',
      description: 'Dummy REST APIs',
      color: '#3B82F6',
    });
    const projectId = projectRes.project.id;
    console.log('create_project →', projectRes.project.name, projectId);

    const colRes = await callTool(client, 'create_collection', {
      teamId,
      projectId,
      name: 'Dummy APIs',
      description: 'Seeded via MCP',
    });
    const collectionId = colRes.collection.id;
    console.log('create_collection →', colRes.collection.name, collectionId);

    for (const env of [
      {
        name: 'Local',
        variables: [
          { key: 'baseUrl', value: 'http://localhost:3001', enabled: true },
          { key: 'token', value: '', enabled: true },
        ],
      },
      {
        name: 'Cloud',
        variables: [
          { key: 'baseUrl', value: BASE, enabled: true },
          { key: 'token', value: '', enabled: true },
        ],
      },
    ]) {
      await callTool(client, 'create_environment', {
        teamId,
        projectId,
        name: env.name,
        variables: env.variables,
      });
      console.log('create_environment →', env.name);
    }

    let created = 0;
    for (const folderDef of FOLDERS) {
      const folderRes = await callTool(client, 'create_folder', {
        collectionId,
        name: folderDef.name,
      });
      const folderId = folderRes.folder.id;
      console.log('create_folder →', folderDef.name);

      for (const req of folderDef.requests) {
        const args = {
          teamId,
          projectId,
          collectionId,
          folderId,
          name: req.name,
          method: req.method,
          url: req.url,
          protocol: 'http',
          headers: jsonHeaders,
          description: `Dummy ${req.method} ${req.name}`,
        };
        if (req.bodyRaw) {
          args.bodyMode = 'raw';
          args.bodyRaw = req.bodyRaw;
          args.bodyRawLanguage = 'json';
        }
        await callTool(client, 'create_request', args);
        created += 1;
      }
    }

    console.log('\nDone via MCP tools');
    console.log({ teamName, teamId, projectId, collectionId, requests: created });
  } finally {
    await client.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
