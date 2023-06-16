/**
 * This code was modified from here (uses a permissive ISC license):
 * https://github.com/amercier/karma-scss-preprocessor/blob/master/src/lib/index.js
 * 
 * Copyright (c) 2016, Alex Mercier pro.alexandre.mercier@gmail.com
 * 
 * The existing karma plugin was forcing the use of node-sass, and we have modified it to
 * allow for configuration to set which sass implementation to use (dart sass in our case).
 * 
 * It may be worth creating a PR against the original plugin in the future when time allows.
 */

import * as dartSass from 'sass';
import * as path from 'path';
import chalk from 'chalk';
import lodash from 'lodash';
import stripAnsi from 'strip-ansi';

const { clone, merge } = lodash;

function formattedScssMessage(error, file): string {
  const filePath = !error || !error.file || error.file === 'stdin' ? file.path : error.file;
  const relativePath = path.relative(process.cwd(), filePath);

  return `${chalk.underline(relativePath)}\n` // eslint-disable-line prefer-template
    + chalk.gray(` ${error.line}:${error.column} `)
    + error.message
      .replace(/: "([^"]*)"\.$/, ': $1')
      .replace(/: (.*)/, `: ${chalk.yellow('$1')}`);
}

interface IScssPreprocessorOptions {
  options?: {
    implementation?: string;
    includePaths?: string[];
  };
}

/**
 * Preprocessor factory
 * @param args   {Object} Config object of custom preprocessor.
 * @param config {Object} Config object of scssPreprocessor.
 * @param logger {Object} Karma's logger.
 */
function createScssPreprocessor(args, config: IScssPreprocessorOptions = {}, logger): any {
  const log = logger.create('preprocessor.scss');

  // Options. See https://www.npmjs.com/package/sass for details
  const options = merge({
    sourceMap: false,
    transformPath(filepath) {
      return filepath.replace(/\.scss$/, '.css');
    }
  }, args.options || {}, config.options || {});

  return function processFile(content, file, done) {
    let result: any = null;

    log.debug('Processing "%s".', file.originalPath);

    // Transform file.path to .css so Karma serves it as a stylesheet
    file.path = file.originalPath.replace(/\.scss$/, '.css'); // eslint-disable-line

    // Clone the options because we need to mutate them
    const opts = clone(options);

    // Add current file's directory into include paths
    opts.includePaths = [path.dirname(file.originalPath)].concat(opts.includePaths || []);

    // Inline source maps
    if (opts.sourceMap) {
      opts.sourceMap = file.path;
      opts.omitSourceMapUrl = true;
    }

    // Compile using sass (synchronously)
    try {
      opts.file = file.originalPath;
      result = dartSass.renderSync(opts);
    } catch (error) {
      const message = formattedScssMessage(error, file);
      log.error('%s\n  at %s:%d', message, file.originalPath, error.line);
      error.message = stripAnsi(message);
      return done(error, null);
    }

    done(null, result.css || result);
    return undefined;
  };
}

// Inject dependencies
createScssPreprocessor.$inject = ['args', 'config.scssPreprocessor', 'logger'];

// Export preprocessor
export default {
  'preprocessor:scss': ['factory', createScssPreprocessor]
};
