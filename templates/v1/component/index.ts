import { defineCustomElement } from '@tyler-components-web/core';

import { <%= data.componentClassName %>Component } from './<%= data.componentName %>';

export * from './<%= data.componentName %>-adapter';
export * from './<%= data.componentName %>-constants';
export * from './<%= data.componentName %>-foundation';
export * from './<%= data.componentName %>';

export function define<%= data.componentClassName %>Component(): void {
  defineCustomElement(<%= data.componentClassName %>Component);
}
