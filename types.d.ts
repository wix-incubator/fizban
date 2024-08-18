declare type RangeName = 'entry' | 'exit' | 'contain' | 'cover' | 'entry-crossing' | 'exit-crossing';

declare type RangeOffset = {
  name?: RangeName;
  offset?: number;
};

declare type scrollConfig = {
  scenes: ScrollScene[];
  transitionActive?: boolean;
  transitionFriction?: number;
}

declare type ScrollScene = {
  effect: (scene: ScrollScene, progress: number) => void;
  start?: RangeOffset;
  duration?: number | RangeName;
  end?: RangeOffset;
  disabled?: boolean;
  viewSource?: HTMLElement;
  groupId?: string;
  ready?: Promise<void>;
}

declare module "fizban";
