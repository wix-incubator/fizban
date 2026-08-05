/**
 * Check whether a value is a Window, including a Window from another realm.
 *
 * `instanceof Window` cannot be used here because it returns false for iframe
 * windows created by a different realm.
 *
 * @param {*} value
 * @return {boolean}
 */
function isWindow (value) {
  return Boolean(
    value && (
      value === window ||
      value.window === value ||
      value.document?.defaultView === value
    )
  );
}

/**
 * Resolve the Window that owns a scroll root or DOM element.
 *
 * @param {Window|Element|undefined|null} root
 * @return {Window}
 */
function getOwnerWindow (root) {
  if (isWindow(root)) {
    return root;
  }

  return root?.ownerDocument?.defaultView || window;
}

export {
  getOwnerWindow,
  isWindow
};
