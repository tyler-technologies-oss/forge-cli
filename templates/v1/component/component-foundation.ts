import { ICustomElementFoundation } from '@tyler-components-web/core';

import { I<%= data.componentClassName %>Adapter } from './<%= data.componentName %>-adapter';

export interface I<%= data.componentClassName %>Foundation extends ICustomElementFoundation {

}

export class <%= data.componentClassName %>Foundation implements I<%= data.componentClassName %>Foundation {
  constructor(private _adapter: I<%= data.componentClassName %>Adapter) {}

  public initialize(): void {

  }

  public disconnect(): void {

  }
}
