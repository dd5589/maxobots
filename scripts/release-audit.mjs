import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = [
  'README.md',
  'Dockerfile',
  'docker-compose.yml',
  'render.yaml',
  '.dockerignore',
  '.env.example',
  'package.json',
  'package-lock.json',
  'data/scenarios.json',
  'data/reasons.json',
  'tests/scenario-flows.test.js',
  'tests/keyboards.test.js',
  'tests/webhook.integration.test.js',
  'scripts/max-live-check.mjs',
  'scripts/run-tests.mjs',
];

const forbidden = [
  'DATA-API.yaml',
  'openapi.yaml',
  'Caddyfile',
  'docker-compose.production.yml',
  'mini-app',
  'src/api',
];

const errors = [];
for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) errors.push(`missing: ${file}`);
}
for (const file of forbidden) {
  if (fs.existsSync(path.join(root, file))) errors.push(`forbidden in no-own-api release: ${file}`);
}

const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const pkg = JSON.parse(read('package.json'));
const lock = JSON.parse(read('package-lock.json'));
if (pkg.version !== '1.1.0') errors.push(`package.json version must be 1.1.0, got ${pkg.version}`);
if (lock.version !== pkg.version || lock.packages?.['']?.version !== pkg.version) errors.push('package-lock version mismatch');
if (pkg.scripts?.test !== 'node scripts/run-tests.mjs') errors.push('npm test must use cross-platform runner');
if (/tests\/\*\.test\.js/.test(pkg.scripts?.test ?? '')) errors.push('old quoted test glob must not be used by npm test');

const scenarios = JSON.parse(read('data/scenarios.json'));
if ((scenarios.scenarios ?? []).length !== 4) errors.push('Expected exactly 4 scenarios');
for (const scenario of scenarios.scenarios ?? []) {
  if (!scenario.buttonTitle) errors.push(`${scenario.id}: missing buttonTitle`);
  if (scenario.buttonTitle?.length > 30) errors.push(`${scenario.id}: buttonTitle too long`);
  for (const q of scenario.questions ?? []) {
    for (const option of q.options ?? []) {
      const label = typeof option === 'object' ? option.label : option;
      if (String(label).length > 30) errors.push(`${scenario.id}/${q.id}: button label too long: ${label}`);
    }
  }
}

const env = read('.env.example');
if (!/^BOT_TOKEN=\s*$/m.test(env)) errors.push('.env.example must contain an empty BOT_TOKEN');
if (env.includes('api.example') || env.includes('replace-before-check')) errors.push('.env.example contains placeholder API deployment values');

const render = read('render.yaml');
for (const token of ['runtime: docker', 'plan: starter', 'BOT_TOKEN', 'MAX_WEBHOOK_SECRET', 'BOT_TRANSPORT']) {
  if (!render.includes(token)) errors.push(`render.yaml missing ${token}`);
}

if (errors.length) {
  console.error('Release audit failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('✅ Release audit passed: no own API/Mini App artifacts, production Webhook deployment and four scenarios are complete');
