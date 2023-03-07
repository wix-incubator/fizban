import test from 'ava';
import './mocks.js';
import { transformSceneRangesToOffsets } from '../src/view.js';

const VIEWPORT_SIZE = 200;
const SMALLER_VIEWPORT_SIZE = 50;

function getScene (overrides = {}) {
  return {
    _rect: {
      start: 300,
      end: 400
    },
    ...overrides
  };
}

test('duration :: entry', t => {
  const input = getScene({duration: 'entry'});
  const result = transformSceneRangesToOffsets(input, VIEWPORT_SIZE);

  t.is(result.start, 100);
  t.is(result.end, 200);
});

test('duration :: contain', t => {
  const input = getScene({duration: 'contain'});
  const result = transformSceneRangesToOffsets(input, VIEWPORT_SIZE);

  t.is(result.start, 200);
  t.is(result.end, 300);
});

test('duration :: exit', t => {
  const input = getScene({duration: 'exit'});
  const result = transformSceneRangesToOffsets(input, VIEWPORT_SIZE);

  t.is(result.start, 300);
  t.is(result.end, 400);
});

test('duration :: entry :: larger than viewport', t => {
  const input = getScene({duration: 'entry'});
  const result = transformSceneRangesToOffsets(input, SMALLER_VIEWPORT_SIZE);

  t.is(result.start, 250);
  t.is(result.end, 300);
});

test('duration :: contain :: larger than viewport', t => {
  const input = getScene({duration: 'contain'});
  const result = transformSceneRangesToOffsets(input, SMALLER_VIEWPORT_SIZE);

  t.is(result.start, 300);
  t.is(result.end, 350);
});

test('duration :: exit :: larger than viewport', t => {
  const input = getScene({duration: 'exit'});
  const result = transformSceneRangesToOffsets(input, SMALLER_VIEWPORT_SIZE);

  t.is(result.start, 350);
  t.is(result.end, 400);
});

test('duration :: cover', t => {
  const input = getScene({duration: 'cover'});
  const result = transformSceneRangesToOffsets(input, VIEWPORT_SIZE);

  t.is(result.start, 100);
  t.is(result.end, 400);
});

test('start :: entry 40% & contain 60%', t => {
  const input = getScene({start: {name: 'entry', offset: 40}, end: {name: 'contain', offset: 60}});
  const result = transformSceneRangesToOffsets(input, VIEWPORT_SIZE);

  t.is(result.start, 140);
  t.is(result.end, 260);
});

test('start :: entry 40% :: end exit 60%', t => {
  const input = getScene({start: {name: 'entry', offset: 40}, end: {name: 'exit', offset: 60}});
  const result = transformSceneRangesToOffsets(input, VIEWPORT_SIZE);

  t.is(result.start, 140);
  t.is(result.end, 360);
});

test('start :: entry 40% :: duration 160px', t => {
  const input = getScene({start: {name: 'entry', offset: 40}, duration: 160});
  const result = transformSceneRangesToOffsets(input, VIEWPORT_SIZE);

  t.is(result.start, 140);
  t.is(result.end, 300);
});

test('start :: entry 40% & contain 60% :: larger than viewport', t => {
  const input = getScene({start: {name: 'entry', offset: 40}, end: {name: 'contain', offset: 60}});
  const result = transformSceneRangesToOffsets(input, SMALLER_VIEWPORT_SIZE);

  t.is(result.start, 270);
  t.is(result.end, 330);
});

test('start :: entry 40% :: end exit 60% :: larger than viewport', t => {
  const input = getScene({start: {name: 'entry', offset: 40}, end: {name: 'exit', offset: 60}});
  const result = transformSceneRangesToOffsets(input, SMALLER_VIEWPORT_SIZE);

  t.is(result.start, 270);
  t.is(result.end, 380);
});

test('start :: entry 40% :: duration 160px :: larger than viewport', t => {
  const input = getScene({start: {name: 'entry', offset: 40}, duration: 160});
  const result = transformSceneRangesToOffsets(input, SMALLER_VIEWPORT_SIZE);

  t.is(result.start, 270);
  t.is(result.end, 430);
});
