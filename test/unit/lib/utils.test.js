const utils = require('../../../src/lib/utils');
const { PAD_LEN } = require('../../../src/defaults');

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

describe('#paddedInt', () => {
  test.each([
    1,
    12345,
  ])('should left pad with zeros', (i) => {
    const padded = utils.paddedInt(i);
    const iStr = `${i}`;
    let pad = PAD_LEN - iStr.length;
    pad = pad < 0 ? 0 : pad;
    const expected = `${'0'.repeat(pad)}${iStr}`;
    expect(padded).toBe(expected);
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
