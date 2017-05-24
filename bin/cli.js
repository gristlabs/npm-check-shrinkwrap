#!/usr/bin/env node
"use strict";

const commander = require('commander');
const main = require('../lib/main.js');

commander
.usage("[options]")
.description(
  `Quickly check if contents of node_modules corresponds to npm-shrinkwrap.json.
  With --install flag, it can automatically run npm install too.`
)
.option("-C, --chdir [dir]", "Work in the given directory instead of the current one")
.option("-v, --all", "Print all modules, not only the problem ones", false)
.option("--no-unwanted", "Ignore node_modules not listed in npm-shrinkwrap.json", false)
.option("--install", "Automatically run 'npm install --no-save' for all missing modules", false)
.option("--no-from", "Ignores differences between package sources", false)
.option("--no-color", "Suppress color output even when the output is to a TTY", false)
.parse(process.argv);

main(commander)
.then(success => {
  process.exit(success ? 0 : 1);
})
.catch(err => {
  console.warn(err.message);
  process.exit(1);
});
