/**
 * @typedef RangeName
 * @type {'entry' | 'contain' | 'exit' | 'cover'}
 */

/**
 * Convert a range into offset in pixels.
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
 * Convert scene data in ranges into offsets in pixels.
 *
 * @param {ScrollScene} scene
 * @param {{start: number, end: number}} rect
 * @param {number} viewportSize
 * @param {boolean} isHorizontal
 * @return {ScrollScene}
 */
function transformSceneRangesToOffsets (scene, rect, viewportSize, isHorizontal) {
  const { start, end, duration } = scene;

  let startOffset = start;
  let endOffset = end;
  let startRange = scene.startRange;
  let endRange = scene.endRange;

  if (typeof duration === 'string') {
    startOffset = transformRangeToPosition({ name: duration, offset: 0 }, viewportSize, rect);
    endOffset = transformRangeToPosition({ name: duration, offset: 100 }, viewportSize, rect);
  }
  else {
    if (startRange || (start && start.name)) {
      startRange = startRange || start;
      startOffset = transformRangeToPosition(startRange, viewportSize, rect);
    }

    if (endRange || (end && end.name)) {
      endRange = endRange || end;
      endOffset = transformRangeToPosition(endRange, viewportSize, rect);
    }
    else if (typeof duration === 'number') {
      endOffset = startOffset + duration;
    }
  }

  return {...scene, start: startOffset, end: endOffset, startRange, endRange };
}

/**
 * Check whether the position of an element is sticky.
 *
 * @param {CSSStyleDeclaration} style
 * @return {boolean}
 */
function getIsSticky (style) {
  return style.position === 'sticky';
}

/**
 * Check whether an element in scroll direction is a scroll container.
 *
 * @param {CSSStyleDeclaration} style
 * @param {boolean} isHorizontal
 * @return {boolean}
 */
function getIsScrollContainer (style, isHorizontal) {
  const overflow = style[`overflow-${isHorizontal ? 'x' : 'y'}`];
  return overflow !== 'visible' && overflow !== 'clip';
}

/**
 * Get offset of an element in scroll direction.
 *
 * @param {CSSStyleDeclaration} style
 * @param {boolean} isHorizontal
 * @return {number}
 */
function getStickyOffset (style, isHorizontal) {
  return parseInt(isHorizontal ? style.left : style.top);
}

/**
 *
 * @param {HTMLElement} element
 * @param {boolean} isHorizontal
 * @return {number}
 */
function getRectStart (element, isHorizontal) {
  // TODO: implement support for RTL writing-mode
  return (isHorizontal ? element.offsetLeft : element.offsetTop) || 0;
}

/**
 * Returns a converted scene data from ranges into offsets in pixels.
 *
 * @param {ScrollScene} scene
 * @param {number} viewportSize
 * @param {boolean} isHorizontal
 * @return {ScrollScene}
 */
export function getTransformedScene (scene, viewportSize, isHorizontal) {
  const element = scene.viewSource;
  let parent = element.offsetParent;
  let elementLayoutStart = getRectStart(element, isHorizontal);
  const size = (isHorizontal ? element.offsetWidth : element.offsetHeight) || 0;
  const offsetTree = [{element, offset: elementLayoutStart, size}];
  let hasScrollParent = false;

  while (parent) {
    // get the base offset of the source element - before adding sticky intervals
    const offset = getRectStart(parent, isHorizontal);
    elementLayoutStart += offset
    offsetTree.push({element: parent, offset});
    parent = parent.offsetParent;
  }

  offsetTree.reverse();

  const transformedScene = transformSceneRangesToOffsets(
    scene,
    {start: elementLayoutStart, end: elementLayoutStart + size},
    viewportSize,
    isHorizontal
  );

  let accumulatedOffset = 0;

  /*
   * check for sticky positioned elements in the tree and add stuck intervals if needed
   */
  offsetTree.forEach((node, index) => {
    accumulatedOffset += node.offset;

    const nodeStyle = window.getComputedStyle(node.element);

    if (!hasScrollParent) {
      const isSticky = getIsSticky(nodeStyle);

      if (isSticky) {
        // TODO: specified offset could be in % or vh, so need to recalc on parent/window resize
        // stuckStart is the amount needed to scroll to reach the stuck state
        const stuckStart = accumulatedOffset - getStickyOffset(nodeStyle, isHorizontal);

        // check if stuckStart is before the point of scroll where the timeline starts
        const isBeforeStart = stuckStart < transformedScene.start;
        // check if stuckStart is inside the timeline's active scroll interval
        const isInsideDuration = !isBeforeStart && stuckStart <= transformedScene.end;

        let extraOffset = 0;
        const parent = offsetTree[index - 1]?.element;

        if (parent) {
          if (isBeforeStart || isInsideDuration) {
            const parentSize = (isHorizontal ? parent.offsetWidth : parent.offsetHeight) || 0;
            const elementOffset = node.offset;
            const elementSize = (isHorizontal ? node.element.offsetWidth : node.element.offsetHeight) || 0;

            extraOffset = parentSize - (elementOffset + elementSize);
            accumulatedOffset += extraOffset;
            transformedScene.end += extraOffset;
          }

          if (isBeforeStart) {
            transformedScene.start += extraOffset;
          }
        }
      }
    }

    hasScrollParent = hasScrollParent && getIsScrollContainer(nodeStyle, isHorizontal);
  });

  return transformedScene;
}
