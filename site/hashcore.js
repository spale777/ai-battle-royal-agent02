// hashkit — hand-written SHA-1 / SHA-224 / SHA-256.
// No crypto.subtle (needs a secure context; this site is plain HTTP).
// Verified byte-for-byte against Python's hashlib in test-hashkit.js.
//
// All three share the same 32-bit SHA-2 core. SHA-224 uses the same core as
// SHA-256 but different initial hash values and a 224-bit (7-word) truncation.
// SHA-1 is a separate (older) core.

'use strict';

// ---- UTF-8 byte encoding (string -> Uint8Array) ---------------------------
function utf8Bytes(str) {
  // TextEncoder is present in all modern browsers and Node.
  return new TextEncoder().encode(str);
}

// ---- 32-bit helpers --------------------------------------------------------
const rotr = (x, n) => (x >>> n) | (x << (32 - n));

// SHA-256 / SHA-224 constants (K) and round functions -----------------------
const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const SHA256_IV = {
  256: new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]),
  224: new Uint32Array([
    0xc1059ed8, 0x367cd507, 0x3070dd17, 0xf70e5939,
    0xffc00b31, 0x68581511, 0x64f98fa7, 0xbefa4fa4,
  ]),
};

// SHA-1 ----------------------------------------------------------------------
const SHA1_IV = new Uint32Array([0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0]);

function sha1Bytes(msg) {
  const bitLen = msg.length * 8;
  const paddedLen = (((msg.length + 8) >> 6) + 1) << 6; // multiple of 64 bytes
  const padded = new Uint8Array(paddedLen);
  padded.set(msg);
  padded[msg.length] = 0x80;
  // Append 64-bit big-endian bit length in the last 8 bytes.
  const dv = new DataView(padded.buffer);
  dv.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);
  dv.setUint32(paddedLen - 4, bitLen >>> 0, false);

  const h = SHA1_IV.slice();
  const w = new Uint32Array(80);
  for (let blk = 0; blk < paddedLen; blk += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(blk + i * 4, false);
    for (let i = 16; i < 80; i++) {
      const n = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16];
      w[i] = (n << 1) | (n >>> 31);
    }
    let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4];
    for (let i = 0; i < 80; i++) {
      let f, k;
      if (i < 20) { f = (b & c) | (~b & d); k = 0x5a827999; }
      else if (i < 40) { f = b ^ c ^ d; k = 0x6ed9eba1; }
      else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc; }
      else { f = b ^ c ^ d; k = 0xca62c1d6; }
      const tmp = ((a << 5) | (a >>> 27)) + f + e + k + w[i];
      e = d; d = c; c = (b << 30) | (b >>> 2); b = a; a = tmp;
    }
    h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0;
    h[3] = (h[3] + d) | 0; h[4] = (h[4] + e) | 0;
  }
  return h;
}

// SHA-224 / SHA-256 ----------------------------------------------------------
function sha2Bytes(msg, bits) {
  const is224 = bits === 224;
  const iv = SHA256_IV[bits];
  const bitLen = msg.length * 8;
  const paddedLen = (((msg.length + 8) >> 6) + 1) << 6; // multiple of 64 bytes
  const padded = new Uint8Array(paddedLen);
  padded.set(msg);
  padded[msg.length] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);
  dv.setUint32(paddedLen - 4, bitLen >>> 0, false);

  const h = iv.slice();
  const w = new Uint32Array(64);
  for (let blk = 0; blk < paddedLen; blk += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(blk + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + SHA256_K[i] + w[i]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0;
    h[3] = (h[3] + d) | 0; h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0;
    h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
  }
  return is224 ? h.slice(0, 7) : h;
}

// ---- Public API -------------------------------------------------------------
function hexWords(words) {
  let out = '';
  for (let i = 0; i < words.length; i++) {
    out += (words[i] >>> 0).toString(16).padStart(8, '0');
  }
  return out;
}

function sha1Hex(str) { return hexWords(sha1Bytes(utf8Bytes(str))); }
function sha224Hex(str) { return hexWords(sha2Bytes(utf8Bytes(str), 224)); }
function sha256Hex(str) { return hexWords(sha2Bytes(utf8Bytes(str), 256)); }

// Node export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { sha1Hex, sha224Hex, sha256Hex, utf8Bytes };
}
