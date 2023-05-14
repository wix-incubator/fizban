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
  let overrideDuration;

  if (typeof duration === 'string') {
    startRange = { name: duration, offset: 0 }
    endRange = { name: duration, offset: 100 }
    startOffset = transformRangeToPosition(startRange, viewportSize, rect);
    endOffset = transformRangeToPosition(endRange, viewportSize, rect);
    overrideDuration = endOffset - startOffset;
  }
  else {
    if (startRange || start?.name) {
      startRange = startRange || start;
      startOffset = transformRangeToPosition(startRange, viewportSize, rect);
    }

    if (endRange || end?.name) {
      endRange = endRange || end;
      endOffset = transformRangeToPosition(endRange, viewportSize, rect);
    }
    else if (typeof duration === 'number') {
      endOffset = startOffset + duration;
    }
  }

  return {...scene, start: startOffset, end: endOffset, startRange, endRange, duration: overrideDuration || duration };
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
 * Get offset of an element in scroll direction.
 *
 * @param {CSSStyleDeclaration} style
 * @param {boolean} isHorizontal
 * @return {number}
 */
function getStickyOffset (style, isHorizontal) {
  // TODO: get also right/bottom offsets
  return parseInt(isHorizontal ? style.left : style.top);
}

/**
 *
 * @param {HTMLElement} element
 * @param {boolean} isHorizontal
 * @param {boolean} isSticky
 * @return {number}
 */
function getRectStart (element, isHorizontal, isSticky) {
  // TODO: implement support for RTL writing-mode
  if (isSticky) {
    element.style.position = 'static';
  }

  const result = (isHorizontal ? element.offsetLeft : element.offsetTop) || 0;

  if (isSticky) {
    // assuming the sticky position came from a stylesheet and not set inline
    element.style.position = null;
  }

  return result
}

/**
 * Returns a converted scene data from ranges into offsets in pixels.
 *
 * @param {ScrollScene} scene
 * @param {Window|HTMLElement} root
 * @param {number} viewportSize
 * @param {boolean} isHorizontal
 * @return {ScrollScene}
 */
export function getTransformedScene (scene, root, viewportSize, isHorizontal) {
  const element = scene.viewSource;
  const elementStyle = window.getComputedStyle(element);
  const isElementSticky = getIsSticky(elementStyle);

  let parent = element.offsetParent;
  let elementLayoutStart = getRectStart(element, isHorizontal, isElementSticky);
  const size = (isHorizontal ? element.offsetWidth : element.offsetHeight) || 0;
  const offsetTree = [{
    element,
    offset: elementLayoutStart,
    size,
    isSticky: isElementSticky,
    style: isElementSticky ? elementStyle : null
  }];

  while (parent) {
    if (parent === root) {
      offsetTree.push({element: parent, offset: 0});
      // if we're at the root don't add its own offset
      break;
    }

    const nodeStyle = window.getComputedStyle(parent);
    const isSticky = getIsSticky(nodeStyle);

    // get the base offset of the source element - before adding sticky intervals
    const offset = getRectStart(parent, isHorizontal, isSticky);
    elementLayoutStart += offset
    offsetTree.push({element: parent, offset, isSticky, style: isSticky ? nodeStyle : null});
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
    const isSticky = node.isSticky;

    if (isSticky) {
      // stuckStart is the amount needed to scroll to reach the stuck state
      const stuckStart = accumulatedOffset - getStickyOffset(node.style, isHorizontal);

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
  });

  return transformedScene;
}
