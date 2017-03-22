<?php

/**
 * A really basic unit test engine wrapper, which simply runs the command from
 * 'unit.engine.xunit.command', and parses output in XUnit format.
 * Based on https://github.com/phacility/arcanist/issues/153.
 *
 * @group unitrun
 */
final class XUnitCommandTestEngine extends ArcanistUnitTestEngine {

  public function run() {
    $config_manager = $this->getConfigurationManager();
    $commands = $config_manager->getConfigFromAnySource('unit.engine.xunit.commands');
    $results = array();
    foreach ($commands as $command) {
      echo "Running unittests: $command\n";
      $future = new ExecFuture('%C', $command);
      $parser = new ArcanistXUnitTestResultParser();
      list($exit, $stdout, $stderr) = $future->resolve();
      $results = array_merge($results, $parser->parseTestResults($stdout));
    }
    return $results;
  }
}
