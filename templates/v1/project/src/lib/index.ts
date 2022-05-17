import { defineCustomElements } from '@tylertech/forge-core';

export const CUSTOM_ELEMENTS = [
  // Custom element classes to register
];

export function defineComponents(): void {
  defineCustomElements(CUSTOM_ELEMENTS);
}
