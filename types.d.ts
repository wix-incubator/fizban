declare type RangeName = 'entry' | 'exit' | 'contain' | 'cover';

declare type RangeOffset = {
  name?: RangeName;
  offset?: number;
};

declare type scrollConfig = {
  scenes: ScrollScene;
  transitionActive?: boolean;
  transitionFriction?: number;
}

declare type ScrollScene = {
  effect: (scene: ScrollScene, progress: number) => void;
  start?: RangeOffset;
  duration?: number | RangeName;
  end?: RangeOffset;
  disabled?: boolean;
  viewSource?: Element;
}

declare module "fizban";
