import test from 'ava';
import './mocks.js';
import { getTransformedScene } from '../src/view.js';

const VIEWPORT_SIZE = 200;
const SMALLER_VIEWPORT_SIZE = 50;
const IS_HORIZONTAL = false;

function getScene (overrides = {}) {
  return {
    viewSource: {
      offsetParent: {}
    },
    ...overrides
  };
}

test('duration :: entry', t => {
  const input = getScene({
    viewSource: {
      offsetParent: {},
      offsetHeight: 150
    },
    duration: 'entry'
  });

  const result = getTransformedScene(input, VIEWPORT_SIZE, IS_HORIZONTAL);

  t.is(result.start, -200);
  t.is(result.end, -50);
});

test('duration :: contain', t => {
  const input = getScene({
    viewSource: {
      offsetParent: {},
      offsetHeight: 150
    },
    duration: 'contain'
  });

  const result = getTransformedScene(input, VIEWPORT_SIZE, IS_HORIZONTAL);

  t.is(result.start, -50);
  t.is(result.end, 0);
});

test('duration :: exit', t => {
  const input = getScene({
    viewSource: {
      offsetParent: {},
      offsetHeight: 150
    },
    duration: 'exit'
  });

  const result = getTransformedScene(input, VIEWPORT_SIZE, IS_HORIZONTAL);

  t.is(result.start, 0);
  t.is(result.end, 150);
});

test('duration :: entry :: larger than viewport', t => {
  const input = getScene({
    viewSource: {
      offsetParent: {},
      offsetHeight: 150
    },
    duration: 'entry'}
  );

  const result = getTransformedScene(input, SMALLER_VIEWPORT_SIZE, IS_HORIZONTAL);

  t.is(result.start, -50);
  t.is(result.end, 0);
});

test('duration :: contain :: larger than viewport', t => {
  const input = getScene({
    viewSource: {
      offsetParent: {},
      offsetHeight: 150
    },
    duration: 'contain'
  });

  const result = getTransformedScene(input, SMALLER_VIEWPORT_SIZE, IS_HORIZONTAL);

  t.is(result.start, 0);
  t.is(result.end, 100);
});

test('duration :: exit :: larger than viewport', t => {
  const input = getScene({
    viewSource: {
      offsetParent: {},
      offsetHeight: 150
    },
    duration: 'exit'
  });

  const result = getTransformedScene(input, SMALLER_VIEWPORT_SIZE, IS_HORIZONTAL);

  t.is(result.start, 100);
  t.is(result.end, 150);
});

test('duration :: cover', t => {
  const input = getScene({
    viewSource: {
      offsetParent: {},
      offsetHeight: 150
    },
    duration: 'cover'
  });

  const result = getTransformedScene(input, VIEWPORT_SIZE, IS_HORIZONTAL);

  t.is(result.start, -200);
  t.is(result.end, 150);
});

test('start :: entry 40% & contain 60%', t => {
  const input = getScene({
    viewSource: {
      offsetParent: {},
      offsetHeight: 150
    },
    start: {name: 'entry', offset: 40},
    end: {name: 'contain', offset: 60}
  });

  const result = getTransformedScene(input, VIEWPORT_SIZE, IS_HORIZONTAL);

  t.is(result.start, -140);
  t.is(result.end, -20);
});

test('start :: entry 40% :: end exit 60%', t => {
  const input = getScene({
    viewSource: {
      offsetParent: {},
      offsetHeight: 150
    },
    start: {name: 'entry', offset: 40},
    end: {name: 'exit', offset: 60}
  });

  const result = getTransformedScene(input, VIEWPORT_SIZE, IS_HORIZONTAL);

  t.is(result.start, -140);
  t.is(result.end, 90);
});

test('start :: entry 40% :: duration 160px', t => {
  const input = getScene({
    viewSource: {
      offsetParent: {},
      offsetHeight: 150
    },
    start: {name: 'entry', offset: 40},
    duration: 160
  });

  const result = getTransformedScene(input, VIEWPORT_SIZE, IS_HORIZONTAL);

  t.is(result.start, -140);
  t.is(result.end, 20);
});

test('start :: entry 40% & contain 60% :: larger than viewport', t => {
  const input = getScene({
    viewSource: {
      offsetParent: {},
      offsetHeight: 150
    },
    start: {name: 'entry', offset: 40},
    end: {name: 'contain', offset: 60}
  });

  const result = getTransformedScene(input, SMALLER_VIEWPORT_SIZE, IS_HORIZONTAL);

  t.is(result.start, -30);
  t.is(result.end, 60);
});

test('start :: entry 40% :: end exit 60% :: larger than viewport', t => {
  const input = getScene({
    viewSource: {
      offsetParent: {},
      offsetHeight: 150
    },
    start: {name: 'entry', offset: 40},
    end: {name: 'exit', offset: 60}
  });

  const result = getTransformedScene(input, SMALLER_VIEWPORT_SIZE, IS_HORIZONTAL);

  t.is(result.start, -30);
  t.is(result.end, 130);
});

test('start :: entry 40% :: duration 160px :: larger than viewport', t => {
  const input = getScene({
    viewSource: {
      offsetParent: {},
      offsetHeight: 150
    },
    start: {name: 'entry', offset: 40},
    duration: 160
  });

  const result = getTransformedScene(input, SMALLER_VIEWPORT_SIZE, IS_HORIZONTAL);

  t.is(result.start, -30);
  t.is(result.end, 130);
});
