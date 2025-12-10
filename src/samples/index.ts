import * as playground from "./playground";

export type Sample = {
  NAME: string;
  MODEL: string;
  TEMPLATE: string;
  DATA: object;
};

export const SAMPLES: Array<Sample> = [playground];

