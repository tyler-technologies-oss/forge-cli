#!/usr/bin/env node
'use strict';

process.title = 'forge';

import { fileURLToPath } from 'url';
import { run } from '../dist/index.js';

run(process, fileURLToPath(import.meta.url));
