export interface SliderSetting {
  type: 'slider';
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
}

export interface SwitchSetting {
  type: 'switch';
  key: string;
  label: string;
  defaultValue: boolean;
}

export interface ColorSetting {
  type: 'color';
  key: string;
  label: string;
  defaultValue: string;
}

export type ExperimentSetting =
  | SliderSetting
  | SwitchSetting
  | ColorSetting;
