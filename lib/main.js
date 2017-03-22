"use strict";

const bluebird = require('bluebird');
const child_process = require('child_process');
const colors = require('colors/safe');
const fs = require('fs');
const path = require('path');
bluebird.promisifyAll(fs);
bluebird.config({ longStackTraces: true });

function getInfo(allModules, name) {
  if (!allModules.has(name)) {
    allModules.set(name, { have: null, want: null });
  }
  return allModules.get(name);
}

/**
 * Implement the check of node_modules against npm-shrinkwrap.json.
 * @param {String} options.chdir: Optional directory to work in, instead of the current one.
 * @param {Boolean} options.all: Print all modules, not only the problem ones.
 * @param {Boolean} options.unwanted: Print unwanted modules too.
 * @param {Boolean} options.install: Automatically run 'npm install' for all missing modules.
 * @param {Function} options.log: Function to log instead of console.log.
 */
function main(options) {
  // Note that we only handle top-level modules in npm-shrinkwrap.json and in node_modules/. In
  // case of npm3+, this includes most dependencies, except for dependencies with conflicting
  // versions.

  options = options || {};
  let chdir = options.chdir || ".";
  let log = options.log || ((...args) => console.log(...args));

  // The Map maps module name to { have: V1, want: V2 }.
  let allModules = new Map();

  return fs.readFileAsync(path.join(chdir, 'npm-shrinkwrap.json'))
  .then(data => {
    let module = JSON.parse(data);
    for (let name in module.dependencies) {
      getInfo(allModules, name).want = module.dependencies[name].version;
    }
    return fs.readdirAsync(path.join(chdir, 'node_modules'));
  })
  .then(dirs => {
    // Add keys from wantedModules to the list of dirs, so that we examine node_modules also for
    // names like '@types/node'. And deduplicate using Set.
    dirs = new Set(dirs.concat(Array.from(allModules.keys())));
    return Array.from(dirs).sort();
  })
  // .map allows processing each entry in parallel, according to the "concurrency" option.
  .map(moduleName => {
    return fs.readFileAsync(path.join(chdir, 'node_modules', moduleName, 'package.json'))
    .then(data => {
      getInfo(allModules, moduleName).have = JSON.parse(data).version;
    })
    .catch(err => {
      // Nothing to do; this module will be missing from actualModules.
    });
  }, { concurrency: 8 }
  )
  .then(() => {
    let toInstall = [];
    let matches = 0;
    Array.from(allModules.keys()).sort().forEach(name => {
      let info = allModules.get(name);
      if (info.have === info.want) {
        matches++;
        if (options.all) {
          log(colors.green(`\u2713 ${name}`) + `: ${info.have} matches`);
        }
      } else if (!info.want) {
        if (options.unwanted) {
          log(colors.red(`\u2717 ${name}`) + `: ${info.have} is ` + colors.red("unwanted"));
        }
      } else if (!info.have) {
        toInstall.push(`${name}@${info.want}`);
        log(colors.red(`\u2717 ${name}`) + `: ${info.want} is ` + colors.red("missing"));
      } else {
        toInstall.push(`${name}@${info.want}`);
        log(colors.red(`\u2717 ${name}`) + `: ${info.have} ` +
          colors.red(`should be ${info.want}`));
      }
    });
    if (!options.install || toInstall.length === 0) {
      // Success if nothing to install.
      return toInstall.length === 0;
    } else {
      let args = ['install', '--no-save'].concat(toInstall);
      log("Running: %s", args.join(" "));
      let c = child_process.spawn('npm', args, { stdio: 'inherit' });
      return new bluebird.Promise((resolve, reject) => {
        c.on('error', reject);
        c.on('exit', (code, signal) => resolve(code));
      })
      .then(code => {
        // Success if npm install exited with 0 exit status. 
        return code === 0;
      });
    }
  });
}

module.exports = main;
