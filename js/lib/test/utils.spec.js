'use strict';

/* eslint-disable no-unused-expressions, no-undef */

require('../../test/setup');
const utils = require('../utils');

function fisherYates(arrayArg) {
  const array = arrayArg;
  let count = array.length;
  let randomnumber;
  let temp;
  while (count) {
    randomnumber = Math.floor((Math.random() * count));
    count -= 1;
    temp = array[count];
    array[count] = array[randomnumber];
    array[randomnumber] = temp;
  }
}

describe('utils', () => {
  describe('#paddedInt', () => {
    it('should left pad with zeros', () => {
      const padded = utils.paddedInt(4, 1);
      padded.should.equal('0001');
    });

    it('should not pad larger integers', () => {
      const padded = utils.paddedInt(4, 12345);
      padded.should.equal('12345');
    });
  });

  describe('#sanitizeVersion', () => {
    it('should convert a number into a padded string', () => {
      const version = utils.sanitizeVersion(1);
      version.should.equal('0000000000000000001');
    });

    it('should not change a string version', () => {
      const rawVersion = 'version';
      const version = utils.sanitizeVersion(rawVersion);
      version.should.equal(rawVersion);
    });

    it('should default to version 1, padded', () => {
      const version = utils.sanitizeVersion(undefined, true);
      version.should.equal('0000000000000000001');
    });
  });

  describe('#sortSecrets', () => {
    it('should sort by name in ascending order', () => {
      const array = Array.from({ length: 10 }, (k, i) => ({ name: `0${i}` }));
      fisherYates(array);
      fisherYates(array);
      fisherYates(array);
      array.sort(utils.sortSecrets);
      array.forEach((next, idx) => next.name.should.equal(`0${idx}`));
    });

    it('should sort by version in descending order', () => {
      const array = Array.from({ length: 10 }, (k, i) => ({ name: 'same', version: `0${i}` }));
      fisherYates(array);
      fisherYates(array);
      fisherYates(array);
      array.sort(utils.sortSecrets);
      array.forEach((next, idx) => next.version.should.equal(`0${9 - idx}`));
    });

    it('should sort by name in ascending order, then version in descending order', () => {
      const array = Array.from({ length: 100 }, (k, i) => ({
        name: `0${i % 10}`,
        version: `0${Math.floor((i / 10))}`,
      }));
      fisherYates(array);
      fisherYates(array);
      fisherYates(array);
      array.sort(utils.sortSecrets);
      array.forEach((next, idx) => {
        const name = `0${Math.floor(idx / 10)}`;
        const version = `0${Math.floor((99 - idx) % 10)}`;
        next.name.should.equal(name);
        next.version.should.equal(version);
      });
    });
  });

  describe('#asPromise', () => {
    it('should return a promise', () => {
      const result = utils.asPromise({}, () => {
      });
      expect(result.then).to.exist;
    });

    it('should insert a callback', () => {
      const fn = function (cb) {
        expect(cb).to.exist;
        cb(undefined, 'Success');
      };
      return utils.asPromise({}, fn)
        .then(res => res.should.equal('Success'));
    });

    it('should handle successful calls', () => {
      const fn = function (cb) {
        cb(undefined, 'Success');
      };
      return utils.asPromise({}, fn)
        .then(res => res.should.equal('Success'));
    });

    it('should insert the correct arguments', () => {
      const arg1 = 'arg1';
      const arg2 = 'arg2';

      const fn = function (one, two, cb) {
        expect(one).to.exist;
        one.should.equal(arg1);
        expect(two).to.exist;
        two.should.equal(arg2);
        expect(cb).to.exist;
        cb(undefined, 'Success');
      };

      return utils.asPromise({}, fn, arg1, arg2)
        .then(res => res.should.equal('Success'));
    });

    it('should handle errors', () => {
      const fn = function (cb) {
        cb(new Error('Error'));
      };
      return utils.asPromise({}, fn)
        .then(res => expect(res).to.not.exist)
        .catch(err => err.message.should.equal('Error'));
    });
  });

  describe('#mapPromise', () => {
    it('calls the promises in order', function () {
      this.timeout(10e3);
      const array = Array.from({ length: 5 }, (v, k) => k);
      let finishedOrder = [];

      function updatFinished(idx) {
        finishedOrder.push(idx);
      }

      return utils.mapPromise(array, i => new Promise(resolve =>
        setTimeout(resolve, 100 * (10 - i), i))
        .then(updatFinished))
        .then(() => {
          finishedOrder.forEach((next, i) => next.should.equal(i));
          finishedOrder = [];
        })
        .then(() => Promise.all(array.map((next, i) => new Promise(resolve =>
          setTimeout(resolve, 100 * (10 - i), i)).then(updatFinished))))
        .then(() => finishedOrder.forEach((next, i) => next.should.equal(4 - i)));
    });
  });
});
