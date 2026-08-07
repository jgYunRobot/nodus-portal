declare module "urdf-loader" {
  import type { Loader, Object3D } from "three";

  export interface URDFJoint extends Object3D {
    setJointValue?: (value: number) => void;
  }

  export interface URDFRobot extends Object3D {
    joints: Record<string, URDFJoint>;
  }

  export default class URDFLoader extends Loader {
    workingPath: string;
    load(
      url: string,
      onLoad: (robot: URDFRobot) => void,
      onProgress?: (event: ProgressEvent<EventTarget>) => void,
      onError?: (event: unknown) => void
    ): void;
  }
}
