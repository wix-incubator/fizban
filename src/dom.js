/**
 * Resolve the Window that owns a scroll root or DOM element.
 *
 * @param {Window|Element|undefined|null} root
 * @return {Window}
 */
function getOwnerWindow (root) {
  if (root && (root === window || root.window === root || root.document?.defaultView === root)) {
    return root;
  }

  return root?.ownerDocument?.defaultView || window;
}

export {
  getOwnerWindow
};
