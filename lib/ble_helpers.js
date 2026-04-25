// JS runtime helpers mirroring functions exported from lib/ble.ts
function consumeNdjsonChunks(buffer, chunk) {
  buffer = (buffer || "") + (chunk || "");
  const lines = [];
  let newlinePos;
  while ((newlinePos = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, newlinePos).trim();
    buffer = buffer.slice(newlinePos + 1);
    if (line.length > 0) lines.push(line);
  }
  return { lines, buffer };
}

function extractAuthToken(result) {
  if (!result || typeof result !== "object") return null;
  if (typeof result.token === "string" && result.token.length > 0) return result.token;
  if (typeof result.jwt === "string" && result.jwt.length > 0) return result.jwt;
  if (typeof result.access_token === "string" && result.access_token.length > 0) return result.access_token;
  return null;
}

module.exports = { consumeNdjsonChunks, extractAuthToken };
