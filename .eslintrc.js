module.exports = {
  "extends": "airbnb",
  "plugins": [
    "chai-expect"
  ],
  "rules": {
    "func-names": "off",

    // doesn't work in node v4 :(
    "strict": "off",
    "prefer-rest-params": "off",
    "react/require-extension": "off",
    "import/no-extraneous-dependencies": "off",
    "class-methods-use-this": "off",
    "eqeqeq": "off"
  },
  "env": {
    "mocha": true
  }
};