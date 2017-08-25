const NUM_CELLS = 16;
const OVERSCAN = 1;
const NUM_CELLS_OVERSCAN = NUM_CELLS + OVERSCAN;

const NUM_CELLS_HEIGHT = 128;
const NUM_CHUNKS_HEIGHT = NUM_CELLS_HEIGHT / NUM_CELLS;

const NUM_RENDER_GROUPS = NUM_CHUNKS_HEIGHT / 2;

const RANGE = 3;

module.exports = {
  NUM_CELLS,
  OVERSCAN,
  NUM_CELLS_OVERSCAN,

  NUM_CELLS_HEIGHT,
  NUM_CHUNKS_HEIGHT,

  NUM_RENDER_GROUPS,

  RANGE,
};