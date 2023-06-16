#!/usr/bin/env node
'use strict';

process.title = 'forge';

// Ensure node version
import semver from 'semver';
import packageJson from '../package.json' assert { type: 'json' };
var currentNodeVersion = process.version.replace('v', '');
var requiresNodeVersion = packageJson.engines.node;

if (!semver.satisfies(currentNodeVersion, requiresNodeVersion)) {
  var chalk = require('chalk');
  console.error(chalk.red(`ERROR: Forge CLI requires Node version ${requiresNodeVersion}`));
  process.exit(1);
}

// Initialize the cli
import { run } from '../dist/esm/index.js';
import { fileURLToPath } from 'url';
run(process, fileURLToPath(import.meta.url));
