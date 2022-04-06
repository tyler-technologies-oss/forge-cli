import { I<%= data.componentClassName %>Component } from './<%= data.componentName %>';

export interface I<%= data.componentClassName %>Adapter {

}

export class <%= data.componentClassName %>Adapter implements I<%= data.componentClassName %>Adapter {
  constructor(private _component: I<%= data.componentClassName %>Component) {}
}
