import { FilterParams } from './filter';

export type EQState = {
  filters: FilterParams[],
  preamp: number
};

export type FilterBank = {
  device: string,
  enabled: boolean,
  eq: EQState
};

export type DeviceFilterMapping = Record<string, FilterBank>;
