import { I<%= data.componentClassName %>TestContext, <%= data.componentConstantName %>_CONSTANTS, define<%= data.componentClassName %>Component } from '<%= data.packageOrg %>/<%= data.packageName %>';

interface ITestContext {
  context: I<%= data.componentClassName %>TestContext;
}

interface I<%= data.componentClassName %>TestContext {
  component: I<%= data.componentClassName %>Component;
  destroy(): void;
}

describe('<%= data.componentClassName %>Component', function(this: ITestContext) {
  beforeAll(function(this: ITestContext) {
    define<%= data.componentClassName %>Component();
  });

  afterEach(function(this: ITestContext) {
    this.context.destroy();
  });

  it('should instantiate component instance', function(this: ITestContext) {
    this.context = setupTextContext();

    expect(this.context.component.shadowRoot).toBeTruthy();
  });

  function setupTextContext(): I<%= data.componentClassName %>TestContext {
    const component = document.createElement(<%= data.componentConstantName %>_CONSTANTS.elementName);
    document.body.appendChild(component);
    return {
      component,
      destroy: () => {
        document.body.removeChild(component);
      }
    };
  }
});
