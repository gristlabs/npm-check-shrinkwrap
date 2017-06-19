"use strict";

const bluebird = require('bluebird');
const child_process = require('child_process');
const colors = require('colors/safe');
const fs = require('fs');
const npa = require("npm-package-arg");
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
 * Logic used by npm to decide if this package comes from the npm registry.
 */
function isRegistrySpecifier(npmSpec) {
  return npmSpec.type === 'range' || npmSpec.type === 'version' || npmSpec.type === 'tag';
}

/**
 * Returns {spec, desc} object, where spec is to use with 'npm install', and desc is a
 * human-friendly description of the package's version.
 */
function getInstallSpec(log, name, version, from, optResolved) {
  // If 'from' indicates that the the package doesn't come from the registry, use 'from'.
  if (from) {
    try {
      let spec = npa(from);
      if (!isRegistrySpecifier(spec)) {
        return {spec: from, desc: `${version} (${from})`, resolved: optResolved};
      }
    } catch (e) {
      log(console.red(`${name}: can't parse version: ${from}`));
    }
  }
  // Otherwise, default to the normal case.
  return {spec: `${name}@${version}`, desc: version};
}

/**
 * Run a command using child_process.spawn(), returning a promise fulfilled with its exit code, or
 * rejected on error.
 */
function runCmd(cmd, args) {
  let c = child_process.spawn(cmd, args, { stdio: 'inherit' });
  return new bluebird.Promise((resolve, reject) => {
    c.on('error', reject);
    c.on('exit', (code, signal) => resolve(code));
  });
}

/**
 * Implement the check of node_modules against npm-shrinkwrap.json.
 * @param {String} options.chdir: Optional directory to work in, instead of the current one.
 * @param {Boolean} options.all: Print all modules, not only the problem ones.
 * @param {Boolean} options.unwanted: Print unwanted modules too.
 * @param {Boolean} options.install: Automatically run 'npm install' for all missing modules.
 * @param {Boolean} options.from: Check that target source matches destination source.
 * The following are mainly for the unittests.
 * @param {Function} options.log: Function to log instead of console.log.
 * @param {Function} options.run: Function to run npm install, instead of `runCmd()`, called as
 *          run(cmd, args), and should return a promise for the exit code.
 */
function main(options) {
  // Note that we only handle top-level modules in npm-shrinkwrap.json and in node_modules/. In
  // case of npm3+, this includes most dependencies, except for dependencies with conflicting
  // versions.

  options = options || {};
  let chdir = options.chdir || ".";
  let log = options.log || ((...args) => console.log(...args));
  let run = options.run || runCmd;

  // The Map maps module name to { have: V1, want: V2 }.
  let allModules = new Map();

  return fs.readFileAsync(path.join(chdir, 'npm-shrinkwrap.json'))
  .then(data => {
    let module = JSON.parse(data);
    for (let name in module.dependencies) {
      let values = module.dependencies[name];
      let from = options.from !== false ? values.from : null;
      getInfo(allModules, name).want = getInstallSpec(log, name, values.version, from,
        values.resolved);
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
  .map(name => {
    return fs.readFileAsync(path.join(chdir, 'node_modules', name, 'package.json'))
    .then(data => {
      let values = JSON.parse(data);
      let from = options.from !== false ? values._from : null;
      getInfo(allModules, name).have = getInstallSpec(log, name, values.version, from);
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
      if (info.have && info.want && info.have.spec === info.want.spec) {
        matches++;
        if (options.all) {
          log(colors.green(`\u2713 ${name}`) + `: ${info.have.desc} matches`);
        }
      } else if (!info.want) {
        if (options.unwanted) {
          log(colors.red(`\u2717 ${name}`) + `: ${info.have.desc} is ` + colors.red("unwanted"));
        }
      } else if (!info.have) {
        toInstall.push(info.want.resolved || info.want.spec);
        log(colors.red(`\u2717 ${name}`) + `: ${info.want.desc} is ` + colors.red("missing"));
      } else {
        toInstall.push(info.want.resolved || info.want.spec);
        log(colors.red(`\u2717 ${name}`) + `: ${info.have.desc} ` +
          colors.red(`should be ${info.want.desc}`));
      }
    });
    if (!options.install || toInstall.length === 0) {
      // Success if nothing to install.
      return toInstall.length === 0;
    } else {
      let cmd = /^win/.test(process.platform) ? 'npm.cmd' : 'npm';
      let args = ['install', '--no-save'].concat(toInstall);
      log(`Running: ${cmd} ${args.join(" ")}`);
      return run(cmd, args)
      .then(code => {
        // Success if npm install exited with 0 exit status.
        return code === 0;
      });
    }
  });
}

module.exports = main;
