import { consumeNdjsonChunks, extractAuthToken } from "../lib/ble";

test("consumeNdjsonChunks — complete single line", () => {
  const msg1 = '{"id":"1","ok":true,"result":{"v":1}}\n';
  const res = consumeNdjsonChunks("", msg1);
  expect(res.lines).toHaveLength(1);
  expect(res.buffer).toBe("");
  expect(JSON.parse(res.lines[0]).id).toBe("1");
});

test("consumeNdjsonChunks — partial then complete", () => {
  const part1 = '{"id":"2","ok":true,"result":{"v":2}}';
  const part2 = "\n{" + '"id":"3","ok":true,"result":{"v":3}}\n';
  const r1 = consumeNdjsonChunks("", part1);
  expect(r1.lines).toHaveLength(0);
  const r2 = consumeNdjsonChunks(r1.buffer, part2);
  expect(r2.lines).toHaveLength(2);
  const ids = r2.lines.map((l) => JSON.parse(l).id).sort();
  expect(ids).toEqual(["2", "3"]);
});

test("extractAuthToken — resolves token, jwt, and access_token fields", () => {
  expect(extractAuthToken({ token: "t1" })).toBe("t1");
  expect(extractAuthToken({ jwt: "j1" })).toBe("j1");
  expect(extractAuthToken({ access_token: "a1" })).toBe("a1");
  expect(extractAuthToken({})).toBeNull();
  expect(extractAuthToken(null)).toBeNull();
});
