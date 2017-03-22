"use strict";

const bluebird = require('bluebird');
const child_process = require('child_process');
const colors = require('colors/safe');
const fs = require('fs');
const path = require('path');
bluebird.promisifyAll(fs);

function getInfo(allModules, name) {
  if (!allModules.has(name)) {
    allModules.set(name, { have: null, want: null });
  }
  return allModules.get(name);
}

function main(options) {
  // Note that we only handle top-level modules in npm-shrinkwrap.json and in node_modules/. In
  // case of npm3+, this includes most dependencies, except for dependencies with conflicting
  // versions.

  // The Map maps module name to { have: V1, want: V2 }.
  let allModules = new Map();

  return fs.readFileAsync('npm-shrinkwrap.json')
  .then(data => {
    let module = JSON.parse(data);
    for (let name in module.dependencies) {
      getInfo(allModules, name).want = module.dependencies[name].version;
    }
    return fs.readdirAsync('node_modules');
  })
  .then(dirs => {
    // Add keys from wantedModules to the list of dirs, so that we examine node_modules also for
    // names like '@types/node'.
    dirs.concat(Array.from(allModules.keys()));
    // Deduplicate the dirs array.
    return Array.from(new Set(dirs)).sort();
  })
  // .map allows processing each entry in parallel, according to the "concurrency" option.
  .map(moduleName => {
    return fs.readFileAsync(path.join('node_modules', moduleName, 'package.json'))
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
          console.log(colors.green(`\u2713 ${name}`) + `: ${info.have} matches`);
        }
      } else if (!info.want) {
        if (options.unwanted) {
          console.log(colors.red(`\u2717 ${name}`) + `: ${info.have} is ` + colors.red("unwanted"));
        }
      } else if (!info.have) {
        toInstall.push(`${name}@${info.want}`);
        console.log(colors.red(`\u2717 ${name}`) + `: ${info.want} is ` + colors.red("missing"));
      } else {
        toInstall.push(`${name}@${info.want}`);
        console.log(colors.red(`\u2717 ${name}`) + `: ${info.have} ` +
          colors.red(`should be ${info.want}`));
      }
    });
    if (!options.install || toInstall.length === 0) {
      // Success if nothing to install.
      return toInstall.length === 0;
    } else {
      let args = ['install', '--no-save'].concat(toInstall);
      console.log("Running: %s", args.join(" "));
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
