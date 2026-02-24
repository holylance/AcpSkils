#!/usr/bin/env node
/**
 * random_number_generator skill for OpenClaw × Virtuals Protocol ACP
 * - Tools:
 *    - random_int(min, max, seed?)
 *    - random_float(min, max, seed?)
 *    - sample(items[], count, seed?)
 * - Limits:
 *    - Common: min >= 0
 *    - random_int: max < Number.MAX_SAFE_INTEGER, integers only
 *    - random_float: max < Number.MAX_VALUE (upper bound exclusive)
 *    - sample: items.length <= 100, count <= items.length
 */

import { Random, MersenneTwister19937 } from 'random-js';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import fs from 'fs';
import path from 'path';
import url from 'url';

type Cfg = {
  DEFAULT_SEED?: string | number;
  SKILL_NAME?: string;
};

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

// ---- Limits ----
const MAX_SAFE_INT = Number.MAX_SAFE_INTEGER; // 9007199254740991
const MAX_FLOAT = Number.MAX_VALUE;           // ≈ 1.7976931348623157e+308
const MAX_ITEMS = 100;

// ---- Config loader ----
function loadCfg(): Cfg {
  const p = path.join(repoRoot, 'config.json');
  if (fs.existsSync(p)) {
    try {
      return JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch {
      return {};
    }
  }
  return {};
}

// ---- Seeded RNG ----
function hashStringToInt(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash << 5) - hash + s.charCodeAt(i);
    hash |= 0; // 32-bit
  }
  return Math.abs(hash);
}

function createRng(seed?: string | number) {
  const cfg = loadCfg();
  const finalSeed = seed ?? cfg.DEFAULT_SEED ?? undefined;

  if (finalSeed !== undefined && finalSeed !== '') {
    const engine = MersenneTwister19937.seed(
      typeof finalSeed === 'string' ? hashStringToInt(finalSeed) : Number(finalSeed)
    );
    return new Random(engine);
  }
  return new Random(MersenneTwister19937.autoSeed());
}

// ---- Utils ----
function ensureNumberFinite(n: number, label: string) {
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    throw new Error(`${label} must be a finite number`);
  }
}

function ensureMinMaxCommon(min: number, max: number) {
  ensureNumberFinite(min, 'min');
  ensureNumberFinite(max, 'max');
  if (min < 0) throw new Error('min must be >= 0');
  if (max <= min) throw new Error('max must be > min');
}

function outputJSON(obj: any) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

// ---- Commands (tools) ----
async function cmdRandomInt(argv: any) {
  const min = Number(argv.min ?? 0);
  const max = Number(argv.max ?? 100);
  const seed = argv.seed as string | number | undefined;

  ensureMinMaxCommon(min, max);

  // int 전용 상한: max < MAX_SAFE_INT
  if (!(max < MAX_SAFE_INT)) {
    throw new Error(`max must be < Number.MAX_SAFE_INTEGER (${MAX_SAFE_INT})`);
  }
  // 정수 여부 확인
  if (!Number.isInteger(min) || !Number.isInteger(max)) {
    throw new Error('min/max must be integers for random_int');
  }

  const rng = createRng(seed);
  const value = rng.integer(min, max); // inclusive
  outputJSON({ tool: 'random_int', value, min, max, seed: seed ?? null });
}

async function cmdRandomFloat(argv: any) {
  const min = Number(argv.min ?? 0);
  const max = Number(argv.max ?? 1);
  const seed = argv.seed as string | number | undefined;

  ensureMinMaxCommon(min, max);

  // float 전용 상한: max < MAX_FLOAT
  if (!(max < MAX_FLOAT)) {
    throw new Error(`max must be < Number.MAX_VALUE (${MAX_FLOAT})`);
  }

  const rng = createRng(seed);
  const value = rng.real(min, max, false); // upper bound exclusive
  outputJSON({ tool: 'random_float', value, min, max, seed: seed ?? null });
}

async function cmdSample(argv: any) {
  let items: any[] = [];
  try {
    if (argv.itemsFile) {
      const body = fs.readFileSync(path.resolve(String(argv.itemsFile)), 'utf-8');
      items = JSON.parse(body);
    } else if (argv.items) {
      items = JSON.parse(String(argv.items));
    }
  } catch {
    throw new Error('items must be a JSON array string or provide --itemsFile path');
  }

  const count = Number(argv.count ?? 1);
  const seed = argv.seed as string | number | undefined;

  if (!Array.isArray(items)) {
    throw new Error('items must be an array');
  }
  if (items.length === 0) {
    throw new Error('items must be a non-empty array');
  }
  if (items.length > MAX_ITEMS) {
    throw new Error(`items length must be <= ${MAX_ITEMS}`);
  }
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error('count must be a positive integer');
  }
  if (count > items.length) {
    throw new Error('count cannot exceed items length');
  }

  const rng = createRng(seed);
  const copy = [...items];
  // Fisher-Yates
  for (let i = copy.length - 1; i > 0; i--) {
    const j = rng.integer(0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  const sample = copy.slice(0, count);
  outputJSON({ tool: 'sample', sample, total: items.length, count, seed: seed ?? null });
}

// ---- CLI wiring ----
const cli = yargs(hideBin(process.argv))
  .scriptName('random_number_generator')
  .command(
    'random_int',
    'Generate a random integer within [min, max] (limits: min>=0, max<MAX_SAFE_INT)',
    (y) =>
      y
        .option('min', { type: 'number', default: 0, describe: 'lower bound (integer, >=0)' })
        .option('max', { type: 'number', default: 100, describe: 'upper bound (integer, < MAX_SAFE_INT)' })
        .option('seed', { type: 'string', describe: 'optional seed (string|number)' }),
    cmdRandomInt
  )
  .command(
    'random_float',
    'Generate a random float within [min, max) (limits: min>=0, max<MAX_FLOAT)',
    (y) =>
      y
        .option('min', { type: 'number', default: 0, describe: 'lower bound (>=0)' })
        .option('max', { type: 'number', default: 1, describe: 'upper bound (< MAX_FLOAT, exclusive)' })
        .option('seed', { type: 'string', describe: 'optional seed (string|number)' }),
    cmdRandomFloat
  )
  .command(
    'sample',
    'Sample N items from a list (Fisher-Yates). Limits: items.length<=100, count<=items.length',
    (y) =>
      y
        .option('items', { type: 'string', describe: 'JSON array string (e.g. "[1,2,3]")' })
        .option('itemsFile', { type: 'string', describe: 'Path to JSON file with array' })
        .option('count', { type: 'number', default: 1, describe: 'how many to sample (<= items.length)' })
        .option('seed', { type: 'string', describe: 'optional seed (string|number)' }),
    cmdSample
  )
  .demandCommand()
  .help();

cli.parse();
