const { afterEach, beforeEach, jest: jestApi } = require('@jest/globals');
const { deserialize, serialize } = require('@ungap/structured-clone');

// Node's native structuredClone creates values outside Jest's VM. Use the polyfill's
// explicit serializer so cloned objects, arrays, dates and collections belong to this VM.
globalThis.structuredClone = (value, options) => {
  if (options?.transfer?.length)
    throw new Error('The unit-test structuredClone polyfill does not support transfer lists.');
  return deserialize(serialize(value));
};

beforeEach(() => {
  // Read the real response body, parsing JSON inside this VM for strict equality checks.
  // No response data is stubbed and invalid/consumed bodies continue to reject.
  jestApi.spyOn(Response.prototype, 'json').mockImplementation(async function json() {
    return JSON.parse(await this.text());
  });
});

// Keep mocks and fake clocks from leaking across tests, including failed assertions.
afterEach(() => {
  jestApi.restoreAllMocks();
  jestApi.clearAllMocks();
  jestApi.useRealTimers();
});
