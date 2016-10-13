'use strict';

const args = process.argv || [];
const Mocha = require('mocha');
const glob = require('glob');
const istanbul = require('istanbul');
const rmrf = require('rimraf');

/**
 * Specify files needed for testing
 */
const files = glob.sync('./js/**/*.spec.js');
const testOuputFolder = './test/results/';
rmrf.sync(testOuputFolder);

/**
 * Set up an environment variables we need for testing
 */

/**
 * Set up the mocha options we want, like don't quit if a test fails
 * @type {{bail: boolean}}
 */
const mochaConfig = {
  bail: false,
};


function startMocha(func) {
  const fn = func || process.exit;
  const mocha = new Mocha(mochaConfig);

  files.forEach(mocha.addFile.bind(mocha));

  mocha.run(fn);
}

/**
 * Add junit reporting
 */
if (args.indexOf('junit') >= 0) {
  mochaConfig.reporter = 'mocha-junit-reporter';
  mochaConfig.reporterOptions = {
    mochaFile: `${testOuputFolder}test-result.xml`,
  };
}

/**
 * Add coverage reports when testing.
 */
if (args.indexOf('coverage') >= 0) {
  const instrumenter = new istanbul.Instrumenter();
  const collector = new istanbul.Collector();

  const coberturaReport = istanbul.Report.create('cobertura', { dir: testOuputFolder });
  const lcovReport = istanbul.Report.create('lcov', { dir: testOuputFolder });

  istanbul.matcherFor({
    includes: ['**/*.js'],
    excludes: ['**/test/**', '**/node_modules/**'],
  }, (error, matcher) => {
    istanbul.hook.hookRequire(matcher, instrumenter.instrumentSync.bind(instrumenter));

    startMocha((results) => {
      collector.add(__coverage__); // eslint-disable-line no-undef

      lcovReport.on('done', () => process.exit(results));
      coberturaReport.on('done', () => lcovReport.writeReport(collector));

      coberturaReport.writeReport(collector);
    });
  });
} else {
  startMocha();
}
