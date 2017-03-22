"use strict";
/* global describe, it, beforeEach, afterEach */

const colors = require('colors');
const path = require('path');
const assert = require('chai').assert;

const main = require('../lib/main.js');

const fixtures = path.join(__dirname, "fixtures");
const caseBad = path.join(fixtures, "case-bad");
const caseGood = path.join(fixtures, "case-good");

describe("main", function() {

  // Helper to collect log messages, so that we can test them.
  let messages = [];
  function collect(...args) {
    messages.push(args.map(a => a.toString()).join(" "));
  }

  let origColors;
  beforeEach(() => {
    // Disable colors, restoring them at the end of each test.
    origColors = colors.enabled;
    colors.enabled = false;
    messages = [];
  });

  afterEach(() => {
    colors.enabled = origColors;
  });

  // Each test case below tests caseBad and caseGood, with other options the same.

  it("should list correct packages by default", function() {
    return main({chdir: caseBad, all: false, unwanted: true, log: collect})
    .then(success => {
      assert.isFalse(success);
      assert.deepEqual(messages, [
        "✗ bluebird: 3.5.0 is unwanted",
        "✗ colors: 1.1.2 should be 1.1.1",
        "✗ foo/baz: 2.2.2 is missing",
        "✗ hello: 3.3.3 is missing",
      ]);
      messages = [];
    })
    .then(() => main({chdir: caseGood, all: false, unwanted: true, log: collect}))
    .then(success => {
      assert.isTrue(success);
      assert.deepEqual(messages, []);
    });
  });

  it("should respect --all option", function() {
    return main({chdir: caseBad, all: true, unwanted: true, log: collect})
    .then(success => {
      assert.isFalse(success);
      assert.deepEqual(messages, [
        "✗ bluebird: 3.5.0 is unwanted",
        "✗ colors: 1.1.2 should be 1.1.1",
        "✓ commander: 2.9.0 matches",
        "✓ foo/bar: 1.0.1 matches",
        "✗ foo/baz: 2.2.2 is missing",
        "✗ hello: 3.3.3 is missing",
      ]);
      messages = [];
    })
    .then(() => main({chdir: caseGood, all: true, unwanted: true, log: collect}))
    .then(success => {
      assert.isTrue(success);
      assert.deepEqual(messages, [
        "✓ bluebird: 3.5.0 matches",
        "✓ colors: 1.1.2 matches",
        "✓ commander: 2.9.0 matches",
        "✓ foo/bar: 1.0.1 matches",
      ]);
    });
  });

  it("should respect --no-unwanted option", function() {
    return main({chdir: caseBad, all: false, unwanted: false, log: collect})
    .then(success => {
      assert.isFalse(success);
      assert.deepEqual(messages, [
        "✗ colors: 1.1.2 should be 1.1.1",
        "✗ foo/baz: 2.2.2 is missing",
        "✗ hello: 3.3.3 is missing",
      ]);
      messages = [];
    })
    .then(() => main({chdir: caseGood, all: false, unwanted: false, log: collect}))
    .then(success => {
      assert.isTrue(success);
      assert.deepEqual(messages, []);
    });
  });
});
