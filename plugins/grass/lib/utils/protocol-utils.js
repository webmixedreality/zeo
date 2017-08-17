const UINT32_SIZE = 4;
const INT32_SIZE = 4;
const FLOAT32_SIZE = 4;
const UINT16_SIZE = 2;
const GRASS_GEOMETRY_HEADER_ENTRIES = 4;
const GRASS_GEOMETRY_HEADER_SIZE = UINT32_SIZE * GRASS_GEOMETRY_HEADER_ENTRIES;

const _getGrassGeometrySizeFromMetadata = metadata => {
  const {numPositions, numNormals, numUvs, numIndices, numBoundingSphere} = metadata;

  return GRASS_GEOMETRY_HEADER_SIZE + // header
    (FLOAT32_SIZE * numPositions) + // positions
    (FLOAT32_SIZE * numUvs) + // uvs
    (FLOAT32_SIZE * numIndices) + // indices
    (FLOAT32_SIZE * numBoundingSphere); // bounding sphere
};

const _getGrassGeometrySize = grassGeometry => {
  const {positions, uvs, indices, boundingSphere} = grassGeometry;

  const numPositions = positions.length;
  const numUvs = uvs.length
  const numIndices = indices.length
  const numBoundingSphere = boundingSphere.length;

  return _getGrassGeometrySizeFromMetadata({
    numPositions,
    numUvs,
    numIndices,
    numBoundingSphere,
  });
};

// stringification

const stringifyGrassGeometry = (grassGeometry, arrayBuffer, byteOffset) => {
  const {positions, uvs, indices, boundingSphere} = grassGeometry;

  if (arrayBuffer === undefined || byteOffset === undefined) {
    const bufferSize = _getGrassGeometrySize(grassGeometry);
    arrayBuffer = new ArrayBuffer(bufferSize);
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(arrayBuffer, byteOffset, GRASS_GEOMETRY_HEADER_ENTRIES);
  headerBuffer[0] = positions.length;
  headerBuffer[1] = uvs.length;
  headerBuffer[2] = indices.length;
  headerBuffer[3] = boundingSphere.length;
  byteOffset += GRASS_GEOMETRY_HEADER_SIZE;

  const positionsBuffer = new Float32Array(arrayBuffer, byteOffset, positions.length);
  positionsBuffer.set(positions);
  byteOffset += FLOAT32_SIZE * positions.length;

  const uvsBuffer = new Float32Array(arrayBuffer, byteOffset, uvs.length);
  uvsBuffer.set(uvs);
  byteOffset += FLOAT32_SIZE * uvs.length;

  const indicesBuffer = new Uint16Array(arrayBuffer, byteOffset, indices.length);
  indicesBuffer.set(indices);
  byteOffset += UINT16_SIZE * indices.length;

  const boundingSphereBuffer = new Float32Array(arrayBuffer, byteOffset, boundingSphere.length);
  boundingSphereBuffer.set(boundingSphere);
  byteOffset += FLOAT32_SIZE * boundingSphere.length;

  return arrayBuffer;
};

// parsing

const parseGrassGeometry = (buffer, byteOffset) => {
  if (byteOffset === undefined) {
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(buffer, byteOffset, GRASS_GEOMETRY_HEADER_ENTRIES);
  const numPositions = headerBuffer[0];
  const numUvs = headerBuffer[1];
  const numIndices = headerBuffer[2];
  const numBoundingSphere = headerBuffer[3];
  byteOffset += GRASS_GEOMETRY_HEADER_SIZE;

  const positionsBuffer = new Float32Array(buffer, byteOffset, numPositions);
  const positions = positionsBuffer;
  byteOffset += FLOAT32_SIZE * numPositions;

  const uvBuffer = new Float32Array(buffer, byteOffset, numUvs);
  const uvs = uvBuffer;
  byteOffset += FLOAT32_SIZE * numUvs;

  const indicesBuffer = new Uint16Array(buffer, byteOffset, numIndices);
  const indices = indicesBuffer;
  byteOffset += UINT16_SIZE * numIndices;

  const boundingSphereBuffer = new Float32Array(buffer, byteOffset, numBoundingSphere);
  const boundingSphere = boundingSphereBuffer;
  byteOffset += FLOAT32_SIZE * numBoundingSphere;

  return {
    buffer,
    positions,
    uvs,
    indices,
    boundingSphere,
  };
};

const parseHeightfield = (buffer, byteOffset) => {
  if (byteOffset === undefined) {
    byteOffset = 0;
  }

  const headerBuffer = new Uint32Array(buffer, byteOffset, 1);
  const numHeightfield = headerBuffer[0];
  byteOffset += UINT32_SIZE * 1;

  const heightfieldBuffer = new Float32Array(buffer, byteOffset, numHeightfield);
  const heightfield = heightfieldBuffer;
  byteOffset += FLOAT32_SIZE * numHeightfield;

  return heightfield;
};

module.exports = {
  stringifyGrassGeometry,
  parseGrassGeometry,
  parseHeightfield,
};
