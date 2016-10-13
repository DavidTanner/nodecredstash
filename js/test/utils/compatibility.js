'use strict';

const nodeV = process.versions.node.split('.');

module.exports = {
  toBuffer(item) {
    return (nodeV[0] > 5 && nodeV[1] > 10) ? Buffer.from(item) : new Buffer(item);
  },
};
