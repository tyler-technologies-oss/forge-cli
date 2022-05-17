import { CustomElement, attachShadowTemplate, ICustomElement } from '@tylertech/forge-core';
import { <%= data.componentClassName %>Adapter } from './<%= data.componentName %>-adapter';
import { <%= data.componentClassName %>Foundation } from './<%= data.componentName %>-foundation';
import { <%= data.componentConstantName %>_CONSTANTS } from './<%= data.componentName %>-constants';

import template from './<%= data.componentName %>.html';
import styles from './<%= data.componentName %>.scss';

export interface I<%= data.componentClassName %>Component extends ICustomElement {

}

declare global {
  interface HTMLElementTagNameMap {
    '<%= data.componentPrefix %>-<%= data.componentName %>': I<%= data.componentClassName %>Component;
  }
}

@CustomElement({
  name: <%= data.componentConstantName %>_CONSTANTS.elementName
})
export class <%= data.componentClassName %>Component extends HTMLElement implements I<%= data.componentClassName %>Component {
  public static get observedAttributes(): string[] {
    return [];
  }

  private _foundation: <%= data.componentClassName %>Foundation;

  constructor() {
    super();
    attachShadowTemplate(this, template, styles);
    this._foundation = new <%= data.componentClassName %>Foundation(new <%= data.componentClassName %>Adapter(this));
  }

  public connectedCallback(): void {
    this._foundation.initialize();
  }

  public disconnectedCallback(): void {
    this._foundation.disconnect();
  }

  public attributeChangedCallback(name: string, oldValue: string, newValue: string): void {

  }
}
