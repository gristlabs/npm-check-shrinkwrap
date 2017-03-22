# npm-check-shrinkwrap

[![Build Status](https://travis-ci.org/gristlabs/npm-check-shrinkwrap.svg?branch=master)](https://travis-ci.org/gristlabs/npm-check-shrinkwrap)
[![npm version](https://badge.fury.io/js/npm-check-shrinkwrap.svg)](https://badge.fury.io/js/npm-check-shrinkwrap)

> Quickly check if contents of node_modules correspond to npm-shrinkwrap.json

If you use `npm shrinkwrap`, you may want to check very quickly (e.g. as a build step) whether
anything in node_modules is missing, or out-of-date. This tiny module does just that. With the
`--install` option, it is similar to `npm install` but much faster.

## Installation

```
npm install --save-dev npm-check-shrinkwrap
```

## Usage

```
$ npm-check-shrinkwrap [--help] [-C] [--all] [--install]
```

When run with no arguments, it examines the versions your top-level node_modules, and your
`npm-shrinkwrap.json` file. It reports any missing modules (those listed in `npm-shrinkwrap.json`,
but missing from node_modules), mismatching versions, and unwanted modules (those in node_modules
that aren't in `npm-shrinkwrap.json`).

With `--all` option, it will list all modules with matching versions as well.

With `--install` option, it will run `npm install --no-save module@version ...` for all missing or
mismatching modules it finds. This is faster than plain `npm install`.

This works nicely with [shrinkpack](https://github.com/JamieMason/shrinkpack): if you have the
correct tar archives available, it will install without using the network (whereas if you run `npm
install module@version` without specifying ALL out-of-date modules, then npm as of 3.10.10 will
frustratingly fetch from the network ignoring your archives.)

If you have unwanted modules, you can either update your `npm-shrinkwrap.json` file (run `npm
shrinkwrap --dev`), or you can delete unwanted packages from `node_modules/`. You can suppress the
output of unwanted modules with `--no-unwanted` option.
