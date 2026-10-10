import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, resample, quantize, textureCompress, weld } from '@gltf-transform/functions';
import sharp from 'sharp';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.argv[2]);
for (const t of doc.getRoot().listTextures()) console.log('tex', t.getName(), t.getMimeType(), t.getSize(), (t.getImage().byteLength/1024).toFixed(0)+'KB');
await doc.transform(
  dedup(), prune(), resample(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [512, 512], quality: 82 }),
  quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 })
);
for (const t of doc.getRoot().listTextures()) console.log('tex*', t.getName(), t.getMimeType(), (t.getImage().byteLength/1024).toFixed(0)+'KB');
await io.write(process.argv[3], doc);
