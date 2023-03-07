/**
 * @typedef RangeName
 * @type {'entry' | 'contain' | 'exit' | 'cover'}
 */

/**
 *
 * @param {{name: RangeName, offset: number}} range
 * @param {number} viewportSize
 * @param {{start: number, end: number}} rect
 * @return {number}
 */
function transformRangeToPosition (range, viewportSize, rect) {
  const { name, offset = 0 } = range;
  const { start, end } = rect;
  const height = end - start;
  const percentage = offset / 100;

  let startPosition, duration;

  if (name === 'entry') {
    startPosition = start - viewportSize;
    duration = Math.min(viewportSize, height);
  }
  else if (name === 'contain') {
    startPosition = Math.min(end - viewportSize, start);
    // it's either VH - height OR height - VH; so it boils down to just the absolute value of that
    duration = Math.abs(viewportSize - height);
  }
  else if (name === 'exit') {
    startPosition = Math.max(start, end - viewportSize);
    duration = Math.min(viewportSize, height);
  }
  else if (name === 'cover') {
    startPosition = start - viewportSize;
    duration = height + viewportSize;
  }

  return (startPosition + percentage * duration) | 0;
}

/**
 *
 * @param {ScrollScene} scene
 * @param {number} viewportSize
 * @return {ScrollScene}
 */
export function transformSceneRangesToOffsets(scene, viewportSize) {
  const { start, end, duration, _rect: rect } = scene;

  let startOffset, endOffset;

  if (typeof duration === 'string') {
    startOffset = transformRangeToPosition({ name: duration, offset: 0 }, viewportSize, rect);
    endOffset = transformRangeToPosition({ name: duration, offset: 100 }, viewportSize, rect);
  }
  else {
    if (start && start.name) {
      startOffset = transformRangeToPosition(start, viewportSize, rect);
    }

    if (end && end.name) {
      endOffset = transformRangeToPosition(end, viewportSize, rect);
    }
    else if (typeof duration === 'number') {
      endOffset = startOffset + duration;
    }
  }

  return { ...scene, start: startOffset, end: endOffset };
}

function getRectStart (element, isHorizontal) {
  //  TODO: implement support for RTL writing-mode
  return (isHorizontal ? element.offsetLeft : element.offsetTop) || 0;
}

/**
 *
 * @param {HTMLElement} element
 * @param {boolean} isHorizontal
 * @return {{start: number, end: number}}
 */
export function getElementLayoutRect (element,  isHorizontal) {
  const size = (isHorizontal ? element.offsetWidth : element.offsetHeight) || 0;
  let start = getRectStart(element, isHorizontal);
  const rect = {
    start,
    end: start + size
  };
  let parent = element.offsetParent

  while (parent) {
    start = getRectStart(parent, isHorizontal);

    rect.start += start;
    rect.end += start;

    parent = parent.offsetParent;
  }

  return rect;
}
