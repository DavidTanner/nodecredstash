'use strict';

/* eslint-disable no-unused-expressions, no-undef */

require('./setup');
const glob = require('glob');

const files = glob.sync('js/**/*.js', null);

describe('coverage', () => {
  files.forEach((file) => {
    if (file.indexOf('/test/') >= 0) {
      return;
    }
    it(`can require ${file}`, () => {
      // require the file to get it instrumented for coverage reports
      require(`../../${file}`); // eslint-disable-line global-require, import/no-dynamic-require
    });
  });
});
