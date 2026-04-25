const assert = require("assert");
const { consumeNdjsonChunks, extractAuthToken } = require("../lib/ble_helpers");

// NDJSON chunking tests
(function testConsumeNdjsonChunksSimple() {
  const msg1 = '{"id":"1","ok":true,"result":{"v":1}}\n';
  const res = consumeNdjsonChunks("", msg1);
  assert.strictEqual(res.lines.length, 1, "should parse one complete line");
  assert.strictEqual(res.buffer, "", "buffer should be empty after complete line");
  assert.strictEqual(JSON.parse(res.lines[0]).id, "1");
})();

(function testConsumeNdjsonChunksPartial() {
  const part1 = '{"id":"2","ok":true,"result":{"v":2}}';
  const part2 = "\n{" + '"id":"3","ok":true,"result":{"v":3}}\n';
  const r1 = consumeNdjsonChunks("", part1);
  assert.strictEqual(r1.lines.length, 0, "no complete lines yet");
  const r2 = consumeNdjsonChunks(r1.buffer, part2);
  assert.strictEqual(r2.lines.length, 2, "should parse two lines after second chunk");
  const ids = r2.lines.map((l) => JSON.parse(l).id).sort();
  assert.deepStrictEqual(ids, ["2", "3"], "parsed ids match expected");
})();

// Token extraction tests
(function testExtractAuthToken() {
  assert.strictEqual(extractAuthToken({ token: "t1" }), "t1");
  assert.strictEqual(extractAuthToken({ jwt: "j1" }), "j1");
  assert.strictEqual(extractAuthToken({ access_token: "a1" }), "a1");
  assert.strictEqual(extractAuthToken({}), null);
  assert.strictEqual(extractAuthToken(null), null);
})();

console.log("ble_parsing tests passed");
