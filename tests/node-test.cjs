const { test: jestTest } = require('@jest/globals');

// Existing frontend suites use node:test(name, callback), including diagnostic messages.
// Register them with Jest so failures, async completion and counts enter its JSON report.
// Original node --test commands still load the real node:test outside this Jest mapping.
function test(name, callback) {
  if (typeof name !== 'string' || typeof callback !== 'function' || arguments.length !== 2)
    throw new TypeError('Jest compatibility supports node:test(name, callback) only.');
  return jestTest(name, async () => {
    await callback(
      Object.freeze({
        diagnostic(message) {
          console.info(message);
        },
      }),
    );
  });
}

module.exports = test;
module.exports.test = test;
