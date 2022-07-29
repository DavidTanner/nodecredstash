const utils = require('../../../src/lib/utils');
const { pause } = require('../utils/general');

const fisherYates = (arrayArg) => {
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
};

describe('utils', () => {
  describe('#paddedInt', () => {
    test('should left pad with zeros', () => {
      const padded = utils.paddedInt(4, 1);
      expect(padded).toBe('0001');
    });

    test('should not pad larger integers', () => {
      const padded = utils.paddedInt(4, 12345);
      expect(padded).toBe('12345');
    });
  });

  describe('#sanitizeVersion', () => {
    test('should convert a number into a padded string', () => {
      const version = utils.sanitizeVersion(1);
      expect(version).toBe('0000000000000000001');
    });

    test('should not change a string version', () => {
      const rawVersion = 'version';
      const version = utils.sanitizeVersion(rawVersion);
      expect(version).toBe(rawVersion);
    });

    test('should default to version 1, padded', () => {
      const version = utils.sanitizeVersion(undefined, true);
      expect(version).toBe('0000000000000000001');
    });
  });

  describe('#sortSecrets', () => {
    test('should sort by name in ascending order', () => {
      const array = Array.from({ length: 10 }, (k, i) => ({ name: `0${i}` }));
      fisherYates(array);
      fisherYates(array);
      fisherYates(array);
      array.sort(utils.sortSecrets);
      array.forEach((next, idx) => expect(next.name).toBe(`0${idx}`));
    });

    test('should sort by version in descending order', () => {
      const array = Array.from({ length: 10 }, (k, i) => ({ name: 'same', version: `0${i}` }));
      fisherYates(array);
      fisherYates(array);
      fisherYates(array);
      array.sort(utils.sortSecrets);
      array.forEach((next, idx) => expect(next.version).toBe(`0${9 - idx}`));
    });

    test('should sort by name in ascending order, then version in descending order', () => {
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
        expect(next.name).toBe(name);
        expect(next.version).toBe(version);
      });
    });
  });

  describe('#asPromise', () => {
    test('should return a promise', () => {
      const result = utils.asPromise({}, () => {
      });
      expect(result.then).toBeDefined();
    });

    test('should insert a callback', () => {
      const fn = function (cb) {
        expect(cb).toBeDefined();
        cb(undefined, 'Success');
      };
      return utils.asPromise({}, fn)
        .then((res) => expect(res).toBe('Success'));
    });

    test('should handle successful calls', () => {
      const fn = function (cb) {
        cb(undefined, 'Success');
      };
      return utils.asPromise({}, fn)
        .then((res) => expect(res).toBe('Success'));
    });

    test('should insert the correct arguments', () => {
      const arg1 = 'arg1';
      const arg2 = 'arg2';

      const fn = function (one, two, cb) {
        expect(one).toBeDefined();
        expect(one).toBe(arg1);
        expect(two).toBeDefined();
        expect(two).toBe(arg2);
        expect(cb).toBeDefined();
        cb(undefined, 'Success');
      };

      return utils.asPromise({}, fn, arg1, arg2)
        .then((res) => expect(res).toBe('Success'));
    });

    test('should handle errors', () => {
      const fn = function (cb) {
        cb(new Error('Error'));
      };
      return utils.asPromise({}, fn)
        .then((res) => expect(res).to.not.exist)
        .catch((err) => expect(err.message).toBe('Error'));
    });
  });

  describe('#mapPromise', () => {
    test('calls the promises in order', () => {
      const array = Array.from({ length: 5 }, (v, k) => k);
      let finishedOrder = [];

      const updatFinished = (idx) => {
        finishedOrder.push(idx);
      };

      return utils.mapPromise(array, (i) => pause(100 * (10 - i), i)
        .then(updatFinished))
        .then(() => {
          finishedOrder.forEach((next, i) => expect(next).toBe(i));
          finishedOrder = [];
        })
        .then(() => Promise.all(
          array.map((next, i) => pause(100 * (10 - i), i).then(updatFinished)),
        ))
        .then(() => finishedOrder.forEach((next, i) => expect(next).toBe(4 - i)));
    }, 10e3);
  });
});
