import test from 'ava';
import './mocks.js';
import { Scroll } from '../src/Scroll.js';

test.beforeEach(() => {
  window.scrollY = 0;
  window.intersections.length = 0;
  window.animationFrameHandlers.length = 0;
  window.intersectionEntries.length = 0;
  window.eventListeners.scroll.clear()
  window.eventListeners.resize.clear()
})

test('constructor :: empty', t => {
  const scroll = new Scroll();

  t.is(scroll.config.root, window);
});

test('constructor :: config', t => {
  const scroll = new Scroll({transitionActive: true});

  t.is(scroll.config.transitionActive, true);
});

test('resetProgress', t => {
  const scrollPosition = {x: 10, y: 20};
  const scroll = new Scroll();

  scroll.resetProgress(scrollPosition);

  t.is(window.scrollX, scrollPosition.x);
  t.is(window.scrollY, scrollPosition.y);
  t.is(scroll.progress.p, scrollPosition.y);
});

test('resetProgress :: animationActive=true', t => {
  const scrollPosition = {x: 10, y: 20};
  const scroll = new Scroll({
    transitionActive: true
  });

  scroll.resetProgress(scrollPosition);

  t.is(window.scrollX, scrollPosition.x);
  t.is(window.scrollY, scrollPosition.y);
  t.is(scroll.progress.p, scrollPosition.y);
  t.is(scroll.currentProgress.p, scrollPosition.y);
});

test('start :: measure progress', t => {
  const scroll = new Scroll({
    root: window,
    scenes: [
      {
        effect() {},
        start: 0,
        duration: 500
      }
    ]
  });

  scroll.start();

  window.scrollTo(10, 1000);
  window.executeAnimationFrame(0);

  t.is(scroll.progress.p, 1000);
});

test('start :: effect progress', t => {
  let progress = 0;
  const scroll = new Scroll({
    root: window,
    scenes: [
      {
        effect(scene, p) {
          progress = p;
        },
        start: 0,
        duration: 500
      }
    ]
  });

  scroll.start();

  window.scrollTo(0, 300);
  window.executeAnimationFrame(0);

  t.is(progress, 0.6);
});

test('start :: effect progress :: view ranges', t => {
  const element = {
    offsetHeight: 100,
    offsetTop: 100,
    offsetParent: {
      offsetTop: 200,
      offsetParent: {
        offsetTop: 0
      }
    }
  };

  let progress = 0;

  const scroll = new Scroll({
    root: window,
    scenes: [
      {
        effect(s, p) {
          progress = p;
        },
        start: {name: 'entry', offset: 50}, // 275
        end: {name: 'contain', offset: 50}, // 325
        viewSource: element
      }
    ]
  });

  scroll.start();

  window.scrollTo(0, 250);
  window.executeAnimationFrame(0);

  t.is(progress, 0);

  window.scrollTo(0, 285);
  window.executeAnimationFrame(1);

  t.is(progress, 0.2);

  window.scrollTo(0, 300);
  window.executeAnimationFrame(2);

  t.is(progress, 0.5);

  window.scrollTo(0, 325);
  window.executeAnimationFrame(3);

  t.is(progress, 1);
});

test('start :: effect progress :: view ranges :: add absolute offsets', t => {
  const element = {
    offsetHeight: 100,
    offsetTop: 100,
    offsetParent: {
      offsetTop: 200,
      offsetParent: {
        offsetTop: 0
      }
    }
  };

  let progress = 0;

  const scroll = new Scroll({
    root: window,
    scenes: [
      {
        effect(s, p) {
          progress = p;
        },
        start: {name: 'entry', offset: 50, add: '-50px'}, // 225
        end: {name: 'contain', offset: 50, add: '-50vh'}, // 300
        viewSource: element
      }
    ]
  });

  scroll.start();

  window.scrollTo(0, 200);
  window.executeAnimationFrame(0);

  t.is(progress, 0);

  window.scrollTo(0, 250);
  window.executeAnimationFrame(1);

  t.is(+progress.toFixed(3), 0.333);

  window.scrollTo(0, 275);
  window.executeAnimationFrame(2);

  t.is(+progress.toFixed(3), 0.667);

  window.scrollTo(0, 300);
  window.executeAnimationFrame(3);

  t.is(progress, 1);

  window.scrollTo(0, 325);
  window.executeAnimationFrame(4);

  t.is(progress, 1);
});

test('start :: effect progress :: view ranges :: duration range', t => {
  const element = {
    offsetHeight: 100,
    offsetTop: 100,
    offsetParent: {
      offsetTop: 200,
      offsetParent: {
        offsetTop: 0
      }
    }
  };

  let progress = 0;

  const scroll = new Scroll({
    root: window,
    scenes: [
      {
        effect(s, p) {
          progress = p;
        },
        duration: 'contain', // 300 - 350
        viewSource: element
      }
    ]
  });

  scroll.start();

  window.scrollTo(0, 285);
  window.executeAnimationFrame(0);

  t.is(progress, 0);

  window.scrollTo(0, 300);
  window.executeAnimationFrame(1);

  t.is(progress, 0);

  window.scrollTo(0, 325);
  window.executeAnimationFrame(2);

  t.is(progress, 0.5);

  window.scrollTo(0, 350);
  window.executeAnimationFrame(3);

  t.is(progress, 1);
});

test('start :: effect progress :: view ranges :: sticky start element', t => {
  const element = {
    offsetHeight: 50,
    offsetTop: 50,
    offsetParent: {
      offsetTop: 100,
      offsetHeight: 200,
      offsetParent: {
        offsetTop: 0
      },
      style: {
        'overflow-y': 'visible'
      }
    },
    style: {
      position: 'sticky',
      top: '0px'
    }
  };

  let progress = 0;

  const scroll = new Scroll({
    root: window,
    scenes: [
      {
        effect(s, p) {
          progress = p;
        },
        start: {name: 'entry', offset: 0}, // 100
        end: {name: 'contain', offset: 100}, // 250
        viewSource: element
      }
    ]
  });

  scroll.start();

  window.scrollTo(0, 80);
  window.executeAnimationFrame();

  t.is(progress, 0);

  window.scrollTo(0, 100);
  window.executeAnimationFrame();

  t.is(progress, 0);

  window.scrollTo(0, 150);
  window.executeAnimationFrame();

  t.is(+progress.toFixed(3), 0.333);

  window.scrollTo(0, 175);
  window.executeAnimationFrame();

  t.is(progress, 0.5);

  window.scrollTo(0, 250);
  window.executeAnimationFrame();

  t.is(progress, 1);

  window.scrollTo(0, 270);
  window.executeAnimationFrame();

  t.is(progress, 1);
});

test('start :: effect progress :: view ranges :: sticky end element', t => {
  const element = {
    offsetHeight: 50,
    offsetTop: 50,
    offsetParent: {
      offsetTop: 100,
      offsetHeight: 200,
      offsetParent: {
        offsetTop: 0
      },
      style: {
        'overflow-y': 'visible'
      }
    },
    style: {
      position: 'sticky',
      bottom: '0px'
    }
  };

  let progress = 0;

  const scroll = new Scroll({
    root: window,
    scenes: [
      {
        effect(s, p) {
          progress = p;
        },
        start: {name: 'contain', offset: 0}, // 100
        end: {name: 'contain', offset: 100}, // 150
        viewSource: element
      }
    ]
  });

  scroll.start();

  window.scrollTo(0, 80);
  window.executeAnimationFrame();

  t.is(progress, 0);

  window.scrollTo(0, 100);
  window.executeAnimationFrame();

  t.is(progress, 0);

  window.scrollTo(0, 110);
  window.executeAnimationFrame();

  t.is(progress, 0.2);

  window.scrollTo(0, 125);
  window.executeAnimationFrame();

  t.is(progress, 0.5);

  window.scrollTo(0, 150);
  window.executeAnimationFrame();

  t.is(progress, 1);

  window.scrollTo(0, 180);
  window.executeAnimationFrame();

  t.is(progress, 1);
});

test('start :: effect progress :: view ranges :: sticky start parent before start', t => {
  const element = {
    offsetHeight: 50,
    offsetTop: 100,
    offsetParent: {
      offsetTop: 50,
      offsetHeight: 150,
      offsetParent: {
        offsetTop: 0,
        offsetHeight: 300,
        style: {
          'overflow-y': 'visible'
        }
      },
      style: {
        position: 'sticky',
        top: '0px'
      }
    }
  };

  let progress = 0;

  const scroll = new Scroll({
    root: window,
    scenes: [
      {
        effect(s, p) {
          progress = p;
        },
        start: {name: 'entry', offset: 0}, // 200
        end: {name: 'contain', offset: 100}, // 250
        viewSource: element
      }
    ]
  });

  scroll.start();

  window.scrollTo(0, 150);
  window.executeAnimationFrame();

  t.is(progress, 0);

  window.scrollTo(0, 200);
  window.executeAnimationFrame();

  t.is(progress, 0);

  window.scrollTo(0, 225);
  window.executeAnimationFrame();

  t.is(+progress, 0.5);

  window.scrollTo(0, 250);
  window.executeAnimationFrame();

  t.is(progress, 1);

  window.scrollTo(0, 260);
  window.executeAnimationFrame();

  t.is(progress, 1);
});

test('start :: effect progress :: view ranges :: sticky end parent before start', t => {
  const element = {
    offsetHeight: 25,
    offsetTop: 50,
    offsetParent: {
      offsetTop: 100,
      offsetHeight: 50,
      offsetParent: {
        offsetTop: 0,
        offsetHeight: 300,
        style: {
          'overflow-y': 'visible'
        }
      },
      style: {
        position: 'sticky',
        bottom: '0px'
      }
    }
  };

  let progress = 0;

  const scroll = new Scroll({
    root: window,
    scenes: [
      {
        effect(s, p) {
          progress = p;
        },
        start: {name: 'exit', offset: 0}, // 150
        end: {name: 'exit', offset: 100}, // 175
        viewSource: element
      }
    ]
  });

  scroll.start();

  window.scrollTo(0, 150);
  window.executeAnimationFrame();

  t.is(progress, 0);

  window.scrollTo(0, 160);
  window.executeAnimationFrame();

  t.is(+progress, 0.4);

  window.scrollTo(0, 170);
  window.executeAnimationFrame();

  t.is(+progress, 0.8);

  window.scrollTo(0, 175);
  window.executeAnimationFrame();

  t.is(progress, 1);
});

test('start :: effect progress :: view ranges :: sticky start parent inside interval', t => {
  const element = {
    offsetHeight: 50,
    offsetTop: 0,
    offsetParent: {
      offsetTop: 50,
      offsetHeight: 150,
      offsetParent: {
        offsetTop: 0,
        offsetHeight: 300,
        style: {
          'overflow-y': 'visible'
        }
      },
      style: {
        position: 'sticky',
        top: '0px'
      }
    }
  };

  let progress = 0;

  const scroll = new Scroll({
    root: window,
    scenes: [
      {
        effect(s, p) {
          progress = p;
        },
        start: {name: 'entry', offset: 0}, // 0
        end: {name: 'contain', offset: 100}, // 150
        viewSource: element
      }
    ]
  });

  scroll.start();

  window.scrollTo(0, 50);
  window.executeAnimationFrame();

  t.is(+progress.toFixed(3), 0.333);

  window.scrollTo(0, 75);
  window.executeAnimationFrame();

  t.is(+progress, 0.5);

  window.scrollTo(0, 100);
  window.executeAnimationFrame();

  t.is(+progress.toFixed(3), 0.667);

  window.scrollTo(0, 150);
  window.executeAnimationFrame();

  t.is(progress, 1);

  window.scrollTo(0, 160);
  window.executeAnimationFrame();

  t.is(progress, 1);
});

test('start :: effect progress :: view ranges :: sticky end parent inside interval', t => {
  const element = {
    offsetHeight: 50,
    offsetTop: 100,
    offsetParent: {
      offsetTop: 50,
      offsetHeight: 150,
      offsetParent: {
        offsetTop: 0,
        offsetHeight: 300,
        style: {
          'overflow-y': 'visible'
        }
      },
      style: {
        position: 'sticky',
        bottom: '0px'
      }
    }
  };

  let progress = 0;

  const scroll = new Scroll({
    root: window,
    scenes: [
      {
        effect(s, p) {
          progress = p;
        },
        start: {name: 'entry', offset: 0}, // 50
        end: {name: 'exit', offset: 50}, // 175
        viewSource: element
      }
    ]
  });

  scroll.start();

  window.scrollTo(0, 50);
  window.executeAnimationFrame();

  t.is(+progress, 0);

  window.scrollTo(0, 75);
  window.executeAnimationFrame();

  t.is(+progress, 0.2);

  window.scrollTo(0, 100);
  window.executeAnimationFrame();

  t.is(+progress, 0.4);

  window.scrollTo(0, 175);
  window.executeAnimationFrame();

  t.is(progress, 1);

  window.scrollTo(0, 200);
  window.executeAnimationFrame();

  t.is(progress, 1);
});

test('start :: effect progress :: view ranges :: with scroll parent', t => {
  const element = {
    offsetHeight: 50,
    offsetTop: 100,
    offsetParent: {
      offsetTop: 50,
      offsetHeight: 100,
      clientHeight: 100,
      style: {
        'overflow-y': 'hidden'
      },
      addEventListener: window.addEventListener,
      removeEventListener: window.removeEventListener,
      scrollTo(x, y) {
        root.scrollLeft = x;
        root.scrollTop = y;

        window.eventListeners.scroll.forEach(listener => listener());
      }
    }
  };
  const root = element.offsetParent;

  let progress = 0;

  const scroll = new Scroll({
    root,
    scenes: [
      {
        effect(s, p) {
          progress = p;
        },
        start: {name: 'entry', offset: 0}, // 0
        end: {name: 'contain', offset: 100}, // 100
        viewSource: element
      }
    ]
  });

  scroll.start();

  window.executeAnimationFrame();

  t.is(progress, 0);

  root.scrollTo(0, 50);
  window.executeAnimationFrame();

  t.is(progress, 0.5);

  root.scrollTo(0, 74);
  window.executeAnimationFrame();

  t.is(progress, 0.74);

  root.scrollTo(0, 100);
  window.executeAnimationFrame();

  t.is(progress, 1);

  root.scrollTo(0, 120);
  window.executeAnimationFrame();

  t.is(progress, 1);
});

test('start :: effect progress :: view ranges :: sticky start element :: with scroll parent', t => {
  const element = {
    offsetHeight: 50,
    offsetTop: 100,
    offsetParent: {
      offsetTop: 50,
      offsetHeight: 200,
      offsetParent: {
        clientHeight: 100,
        offsetHeight: 100,
        style: {
          'overflow-y': 'hidden'
        },
        addEventListener: window.addEventListener,
        removeEventListener: window.removeEventListener,
        scrollTo(x, y) {
          root.scrollLeft = x;
          root.scrollTop = y;

          window.eventListeners.scroll.forEach(listener => listener());
        }
      }
    },
    style: {
      position: 'sticky',
      top: '50px'
    }
  };
  const root = element.offsetParent.offsetParent;

  let progress = 0;

  const scroll = new Scroll({
    root,
    scenes: [
      {
        effect(s, p) {
          progress = p;
        },
        start: {name: 'entry', offset: 0}, // 50
        end: {name: 'contain', offset: 100}, // 200
        viewSource: element
      }
    ]
  });

  scroll.start();

  window.executeAnimationFrame();

  t.is(progress, 0);

  root.scrollTo(0, 50);
  window.executeAnimationFrame();

  t.is(progress, 0);

  root.scrollTo(0, 100);
  window.executeAnimationFrame();

  t.is(+progress.toFixed(2), 0.33);

  root.scrollTo(0, 150);
  window.executeAnimationFrame();

  t.is(+progress.toFixed(2), 0.67);

  root.scrollTo(0, 200);
  window.executeAnimationFrame();

  t.is(progress, 1);
});

test('start :: effect progress :: view ranges :: sticky start element :: after end of range', t => {
  const element = {
    offsetHeight: 25,
    offsetTop: 50,
    offsetParent: {
      offsetTop: 100,
      offsetHeight: 200,
      offsetParent: {
        offsetTop: 0
      },
      style: {
        'overflow-y': 'visible'
      }
    },
    style: {
      position: 'sticky',
      top: '0px'
    }
  };

  let progress = 0;

  const scroll = new Scroll({
    root: window,
    scenes: [
      {
        effect(s, p) {
          progress = p;
        },
        start: {name: 'entry', offset: 0}, // 100
        end: {name: 'entry', offset: 100}, // 125
        viewSource: element
      }
    ]
  });

  scroll.start();

  window.scrollTo(0, 80);
  window.executeAnimationFrame();

  t.is(progress, 0);

  window.scrollTo(0, 100);
  window.executeAnimationFrame();

  t.is(progress, 0);

  window.scrollTo(0, 110);
  window.executeAnimationFrame();

  t.is(progress, 0.4);

  window.scrollTo(0, 125);
  window.executeAnimationFrame();

  t.is(progress, 1);
});

test('start :: effect progress :: velocityActive=true', t => {
  let progress = 0;
  let velocity = 0;
  const scroll = new Scroll({
    root: window,
    velocityActive: true,
    velocityMax: 400,
    scenes: [
      {
        effect(scene, p, v) {
          progress = p;
          velocity = v;
        },
        start: 0,
        duration: 500
      }
    ]
  });

  scroll.start();

  window.scrollTo(0, 300);
  window.executeAnimationFrame(0);

  t.is(progress, 0.6);
  t.is(velocity, 300 / 400);
});

test('start :: effect progress :: velocityActive=true with transitionActive=true', t => {
  let progress = 0;
  let velocity = 0;
  const scroll = new Scroll({
    root: window,
    transitionActive:  true,
    transitionFriction: 0.5,
    velocityActive: true,
    velocityMax: 400,
    scenes: [
      {
        effect(scene, p, v) {
          progress = p;
          velocity = v;
        },
        start: 0,
        duration: 500
      }
    ]
  });

  scroll.start();

  window.scrollTo(0, 300);
  window.executeAnimationFrame(0);

  t.is(progress, 0.3);
  t.is(velocity, 150 / 400);
});

test('start :: effect progress :: transitionActive=true', t => {
  let progress = 0;
  const scroll = new Scroll({
    root: window,
    transitionActive: true,
    transitionFriction: 0.5,
    scenes: [
      {
        effect(scene, p) {
          progress = p;
        },
        start: 0,
        duration: 500
      }
    ]
  });

  scroll.start();

  window.scrollTo(0, 300);
  window.executeAnimationFrame(0);

  t.is(progress, 0.3);
});

test('viewport :: disable', t => {
  let progress = 0;
  const viewSource = {};
  const scrollY1 = 50;
  const scrollY2 = 300;
  const scroll = new Scroll({
    root: window,
    scenes: [
      {
        effect(scene, p) {
          progress = p;
        },
        start: 0,
        duration: 100,
        viewSource
      }
    ]
  });

  scroll.start();

  window.intersectionEntries.push({
    isIntersecting: true,
    target: viewSource
  });

  window.scrollTo(0, scrollY1);
  window.executeAnimationFrame(0);

  t.is(progress, 0.5);
  t.is(scroll.config.scenes[0].disabled, false);

  window.scrollTo(0, 75);
  window.executeAnimationFrame(0);

  t.is(progress, 0.75);

  window.scrollTo(0, scrollY2);
  window.intersectionEntries.push({
    isIntersecting: false,
    target: viewSource
  });
  window.executeAnimationFrame(1);

  t.is(scroll.config.scenes[0].disabled, true);
});

test('pause', t => {
  let progress = 0;
  const scroll = new Scroll({
    root: window,
    scenes: [
      {
        effect(scene, p) {
          progress = p;
        },
        start: 0,
        duration: 500
      }
    ]
  });

  scroll.start();

  window.scrollTo(0, 300);
  window.executeAnimationFrame(0);

  t.is(progress, 0.6);

  const scrollListenersSize = window.eventListeners.scroll.size

  scroll.pause();

  t.is(window.eventListeners.scroll.size, scrollListenersSize - 1);
});

test('destroy :: destroy scene', t => {
  let destroyed = false;
  const scroll = new Scroll({
    root: window,
    scenes: [
      {
        effect() {},
        destroy() { destroyed = true; }
      }
    ]
  });

  scroll.start();

  window.scrollTo(0, 300);
  window.executeAnimationFrame();

  const scrollListenersSize = window.eventListeners.scroll.size

  scroll.destroy();

  t.is(window.eventListeners.scroll.size, scrollListenersSize - 1);
  t.is(scroll.effect === null, true);
  t.is(destroyed, true);
});
