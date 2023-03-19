declare type scrollConfig = {
  scenes: ScrollScene;
  transitionActive?: boolean;
  transitionFriction?: number;
}

declare type ScrollScene = {
  effect: (scene: ScrollScene, progress: number) => void;
  start?: number;
  duration?: number;
  end?: number;
  disabled?: boolean;
  viewSource?: Element;
}

declare module "fizban";
