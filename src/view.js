/**
 * parses offsetString of the format calc(<length> + <length>)
 * @param {string|undefined} offsetString
 * @param {AbsoluteOffsetContext} absoluteOffsetContext
 */
function parseOffsetCalc(offsetString, absoluteOffsetContext) {
  const match = offsetString.match(/^calc\s*\(\s*(-?\d+((px)|(vh)|(vw)))\s*\+\s*(-?\d+((px)|(vh)|(vw)))\s*\)\s*$/);
  return transformAbsoluteOffsetToNumber(match[1], absoluteOffsetContext) + transformAbsoluteOffsetToNumber(match[6], absoluteOffsetContext);
}

/**
 * Convert an absolute offset as string to number of pixels
 *
 * @param {string|undefined} offsetString
 * @param {AbsoluteOffsetContext} absoluteOffsetContext
 * @return {number}
 */
function transformAbsoluteOffsetToNumber (offsetString, absoluteOffsetContext) {
  return offsetString
    ? /^-?\d+px$/.test(offsetString)
      ? parseInt(offsetString)
      : /^-?\d+vh$/.test(offsetString)
        ? parseInt(offsetString) * absoluteOffsetContext.viewportHeight / 100
        : /^-?\d+vw$/.test(offsetString)
          ? parseInt(offsetString) * absoluteOffsetContext.viewportWidth / 100
          : /^calc\s*\(\s*-?\d+((px)|(vh)|(vw))\s*\+\s*-?\d+((px)|(vh)|(vw))\s*\)\s*$/.test(offsetString)
            ? parseOffsetCalc(offsetString, absoluteOffsetContext)
            : parseInt(offsetString) || 0
    : 0;
}

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
  else if (name === 'entry-crossing') {
    startPosition = start - viewportSize;
    duration = height;
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
  else if (name === 'exit-crossing') {
    startPosition = start;
    duration = height;
  }
  else if (name === 'cover') {
    startPosition = start - viewportSize;
    duration = height + viewportSize;
  }

  return (startPosition + percentage * duration) | 0;
}

function computeStickinessIntoFullRange(offsetTree, absoluteStartOffset, absoluteEndOffset, viewportSize, isHorizontal) {
  let accumulatedOffset = 0;
  const newAbsoluteRange = {start: absoluteStartOffset, end: absoluteEndOffset}

  /*
   * loop from root down to subject
   * check for sticky positioned elements in the tree and add stuck intervals if needed
   */
  offsetTree.forEach((node, index) => {
    accumulatedOffset += node.offset;
    const sticky = node.sticky;

    if (sticky) {
      if ('end' in sticky) {
        const parent = offsetTree[index - 1]?.element;

        if (parent) {
          const elementSize = (isHorizontal ? node.element.offsetWidth : node.element.offsetHeight) || 0;
          const offsetFromViewEnd = elementSize + sticky.end - viewportSize;
          /*
           * Sticky bottom:
           * starts on the starting edge of element's parent - viewport size + element size + offset from bottom of view
           * ends on the element's offset + offset from bottom of view
           * duration is essentially element's offset
           */
          const stuckStart = accumulatedOffset + offsetFromViewEnd - node.offset;
          // check if stuckStart is before the point of scroll where the timeline starts
          const isBeforeStart = stuckStart < newAbsoluteRange.start;
          // check if stuckStart is inside the timeline's active scroll interval
          const isInsideDuration = !isBeforeStart && stuckStart <= absoluteEndOffset;

          let extraOffset = 0;
          if (isBeforeStart || isInsideDuration) {
            extraOffset = node.offset;
            newAbsoluteRange.end += extraOffset;
          }

          if (isBeforeStart) {
            newAbsoluteRange.start += extraOffset;
          }
        }
      }

      if ('start' in sticky) {
        // stuckStart is the amount needed to scroll to reach the stuck state
        const stuckStart = accumulatedOffset - sticky.start;

        // check if stuckStart is before the point of scroll where the timeline starts
        const isBeforeStart = stuckStart < newAbsoluteRange.start;
        // check if stuckStart is inside the timeline's active scroll interval
        const isInsideDuration = !isBeforeStart && stuckStart <= newAbsoluteRange.end;

        let extraOffset = 0;
        const parent = offsetTree[index - 1]?.element;

        if (parent) {
          if (isBeforeStart || isInsideDuration) {
            const parentSize = (isHorizontal ? parent.offsetWidth : parent.offsetHeight) || 0;
            const elementOffset = node.offset;
            const elementSize = (isHorizontal ? node.element.offsetWidth : node.element.offsetHeight) || 0;

            extraOffset = parentSize - (elementOffset + elementSize);
            accumulatedOffset += extraOffset;
            newAbsoluteRange.end += extraOffset;
          }

          if (isBeforeStart) {
            newAbsoluteRange.start += extraOffset;
          }
        }
      }
    }
  });

  return newAbsoluteRange;
}

/**
 * Convert scene data in ranges into offsets in pixels.
 *
 * @param {ScrollScene} scene
 * @param {{start: number, end: number}} rect
 * @param {number} viewportSize
 * @param {boolean} isHorizontal
 * @param {AbsoluteOffsetContext} absoluteOffsetContext
 * @param {Array<{element: HTMLElement, offset: number, sticky: {start?: number, end?: number}}>} offsetTree
 * @return {ScrollScene}
 */
function transformSceneRangesToOffsets (scene, rect, viewportSize, isHorizontal, absoluteOffsetContext, offsetTree) {
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

    const newAbsoluteRange = computeStickinessIntoFullRange(offsetTree, startOffset, endOffset, viewportSize, isHorizontal);

    startOffset = newAbsoluteRange.start;
    endOffset = newAbsoluteRange.end;
  }
  else {
    if (startRange || start?.name) {
      startRange = startRange || start;

      const startAdd = transformAbsoluteOffsetToNumber(startRange.add, absoluteOffsetContext);
      const absoluteStartOffset = transformRangeToPosition({...startRange, offset: 0}, viewportSize, rect);
      const absoluteEndOffset = transformRangeToPosition({...startRange, offset: 100}, viewportSize, rect);
      // we take 0% to 100% of the named range for start, and we compute the position by adding the sticky addition for the given start offset
      const newAbsoluteRange = computeStickinessIntoFullRange(offsetTree, absoluteStartOffset, absoluteEndOffset, viewportSize, isHorizontal);

      startOffset = newAbsoluteRange.start + (startRange.offset / 100) * (newAbsoluteRange.end - newAbsoluteRange.start) + startAdd;
    }

    if (endRange || end?.name) {
      endRange = endRange || end;

      const endAdd = transformAbsoluteOffsetToNumber(endRange.add, absoluteOffsetContext);
      const absoluteStartOffset = transformRangeToPosition({...endRange, offset: 0}, viewportSize, rect);
      const absoluteEndOffset = transformRangeToPosition({...endRange, offset: 100}, viewportSize, rect);
      // we take 0% to 100% of the named range for end, and we compute the position by adding the sticky addition for the given end offset
      const newAbsoluteRange = computeStickinessIntoFullRange(offsetTree, absoluteStartOffset, absoluteEndOffset, viewportSize, isHorizontal);

      endOffset = newAbsoluteRange.start + (endRange.offset / 100) * (newAbsoluteRange.end - newAbsoluteRange.start) + endAdd;
    }
    else if (typeof duration === 'number') {
      endOffset = startOffset + duration;
    }
  }

  if (!overrideDuration && !duration) {
    overrideDuration = endOffset - startOffset;
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
 * Get start offset of an element in scroll direction.
 *
 * @param {CSSStyleDeclaration} style
 * @param {boolean} isHorizontal
 * @return {number}
 */
function getStickyStartOffset (style, isHorizontal) {
  return parseInt(isHorizontal ? style.left : style.top);
}

/**
 * Get end offset of an element in scroll direction.
 *
 * @param {CSSStyleDeclaration} style
 * @param {boolean} isHorizontal
 * @return {number}
 */
function getStickyEndOffset (style, isHorizontal) {
  return parseInt(isHorizontal ? style.right : style.bottom);
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

function getStickyData (style, isHorizontal) {
  let sticky;
  const stickyStart = getStickyStartOffset(style, isHorizontal);
  const stickyEnd = getStickyEndOffset(style, isHorizontal);
  const hasStickyStart = !isNaN(stickyStart);
  const hasStickyEnd = !isNaN(stickyEnd);

  if (hasStickyStart || hasStickyEnd) {
    sticky = {};

    if (hasStickyStart) {
      sticky.start = stickyStart;
    }
    if (hasStickyEnd) {
      sticky.end = stickyEnd;
    }
  }

  return sticky;
}

/**
 * Returns an array of converted scenes' data for grouped scenes (assumes same viewSource) from ranges into offsets in pixels.
 *
 * @param {ScrollScene[]} scenes
 * @param {Window|HTMLElement} root
 * @param {number} viewportSize
 * @param {boolean} isHorizontal
 * @param {AbsoluteOffsetContext} absoluteOffsetContext
 * @return {ScrollScene[]}
 */
export function getTransformedSceneGroup (scenes, root, viewportSize, isHorizontal, absoluteOffsetContext) {
  const element = scenes[0].viewSource;
  const elementStyle = window.getComputedStyle(element);
  const isElementSticky = getIsSticky(elementStyle);
  const elementStickiness = isElementSticky ? getStickyData(elementStyle, isHorizontal) : undefined;

  let parent = element.offsetParent;
  let elementLayoutStart = 0;
  let isFixed = elementStyle.position === 'fixed';
  const elementOffset = getRectStart(element, isHorizontal, isElementSticky);

  // if we have sticky end (bottom or right) ignore offset for this element because it will stick to its parent's start edge
  if (!elementStickiness || !('end' in elementStickiness)) {
    elementLayoutStart += elementOffset;
  }

  const size = (isHorizontal ? element.offsetWidth : element.offsetHeight) || 0;
  const offsetTree = [{
    element,
    offset: elementOffset,
    size,
    sticky: elementStickiness,
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
    const sticky = isSticky ? getStickyData(nodeStyle, isHorizontal) : undefined;

    // get the base offset of the source element - before adding sticky intervals
    const offset = getRectStart(parent, isHorizontal, isSticky);

    // if we have sticky end (bottom or right) ignore offset for this element because it will stick to its parent's start edge
    if (!sticky || !('end' in sticky)) {
      elementLayoutStart += offset;
    }

    offsetTree.push({element: parent, offset, sticky});
    parent = parent.offsetParent;

    if (!parent) {
      // only if offsetParent is null do we know that the fixed element is actually fixed to the viewport and we need to set duration to 0
      isFixed = nodeStyle.position === 'fixed';
    }
  }

  offsetTree.reverse();

  const transformedScenes = scenes.map(scene => ({
    ...transformSceneRangesToOffsets(
      scene,
      {start: elementLayoutStart, end: elementLayoutStart + size},
      viewportSize,
      isHorizontal,
      absoluteOffsetContext,
      offsetTree
    ),
    isFixed
  }));

  return transformedScenes;
}

/**
 * Returns a converted scene data from ranges into offsets in pixels.
 *
 * @param {ScrollScene} scene
 * @param {Window|HTMLElement} root
 * @param {number} viewportSize
 * @param {boolean} isHorizontal
 * @param {AbsoluteOffsetContext} absoluteOffsetContext
 * @return {ScrollScene}
 */
export function getTransformedScene (scene, root, viewportSize, isHorizontal, absoluteOffsetContext) {
  return getTransformedSceneGroup([scene], root, viewportSize, isHorizontal, absoluteOffsetContext)[0];
}

