declare type RangeName = 'entry' | 'exit' | 'contain' | 'cover' | 'entry-crossing' | 'exit-crossing';

declare type RangeOffset = {
  name?: RangeName;
  offset?: number;
};

declare type scrollConfig = {
  scenes: ScrollScene[];
  horizontal?: boolean;
  transitionActive?: boolean;
  transitionFriction?: number;
  velocityActive?: boolean;
  velocityMax?: number;
  observeViewportEntry?: boolean;
  viewportRootMargin?: string;
  observeViewportResize?: boolean;
  observeSourcesResize?: boolean;
  root?: Element | Window;
}

declare type ScrollScene = {
  effect: (scene: ScrollScene, progress: number) => void;
  start?: RangeOffset;
  duration?: number | RangeName;
  end?: RangeOffset;
  disabled?: boolean;
  viewSource?: HTMLElement;
  groupId?: string;
}

declare module "fizban";
