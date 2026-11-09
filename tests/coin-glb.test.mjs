import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Coinflip uses a genuine, valid binary glTF 3D model", () => {
  const data = readFileSync(new URL("../public/models/blockbet-gold-heads-tails.glb", import.meta.url));
  assert.equal(data.readUInt32LE(0), 0x46546c67, "GLB binary magic");
  assert.equal(data.readUInt32LE(4), 2, "glTF 2.0");
  assert.equal(data.readUInt32LE(8), data.length, "file byte length");
  const jsonLength = data.readUInt32LE(12);
  assert.equal(data.readUInt32LE(16), 0x4e4f534a, "GLB JSON chunk");
  const manifest = JSON.parse(data.subarray(20, 20 + jsonLength).toString("utf8").trim());
  const meshes = manifest.meshes.map(mesh => mesh.name);
  assert.ok(meshes.includes("SOLID_GOLD_COIN"));
  assert.ok(meshes.includes("HEADS_EMBOSSED_3D_TEXT"));
  assert.ok(meshes.includes("TAILS_EMBOSSED_3D_TEXT"));
  assert.ok(manifest.materials.some(material => material.name.includes("gold")));
  for (const mesh of manifest.meshes) {
    const accessor = manifest.accessors[mesh.primitives[0].attributes.POSITION];
    assert.equal(accessor.min.length, 3, "3D model needs position bounds");
    assert.equal(accessor.max.length, 3, "3D model needs position bounds");
  }
  assert.equal(manifest.buffers.length, 1);
  const binaryAt = 20 + jsonLength;
  assert.equal(data.readUInt32LE(binaryAt + 4), 0x004e4942, "GLB BIN chunk");
  assert.equal(data.readUInt32LE(binaryAt), manifest.buffers[0].byteLength);
});

test("Only the Flip game was given the new 3D coin model", () => {
  const flip = readFileSync(new URL("../src/games/Flip.tsx", import.meta.url), "utf8");
  const component = readFileSync(new URL("../src/components/GoldCoin3D.tsx", import.meta.url), "utf8");
  assert.match(flip, /<GoldCoin3D degrees=\{deg\} spinning=\{busy\}/);
  assert.doesNotMatch(flip, /\/coin\/heads\.svg|\/coin\/tails\.svg/);
  assert.match(component, /\/models\/blockbet-gold-heads-tails\.glb/);
  assert.match(component, /model-viewer/);
  assert.match(component, /rotateY/);
});
