/**
 * Ziggurat Toolchain exec script.
 */
const chalk    = require('chalk');
const argv     = require('yargs').argv;
const execSync = require('child_process').execSync;

try {
  execSync(`gulp --gulpfile toolchain.mjs ${argv._[0] ? argv._[0] : ''} ${argv.project ? `--project ${argv.project}` : ''} ${argv.debug === 1 ? '' : '--silent'}`, {stdio:[0, 1, 2]});
} catch (error) {
  if (error.status !== 5) {
    console.error(chalk.red(`[Ziggurat] An unexpected error has occurred and Ziggurat has been shut down`));
  }
}
