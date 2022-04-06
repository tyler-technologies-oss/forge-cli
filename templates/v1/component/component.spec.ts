import { <%= data.componentClassName %>Component, <%= data.componentConstantName %>_CONSTANTS, define<%= data.componentClassName %>Component } from '<%= data.packageOrg %>/<%= data.packageName %>';

describe('<%= data.componentClassName %>Component', () => {
  let componentInstance: <%= data.componentClassName %>Component;
  let fixtureContainer: HTMLElement;

  beforeAll(() => {
    define<%= data.componentClassName %>Component();
    fixtureContainer = document.createElement('div');
    document.body.appendChild(fixtureContainer);
  });

  beforeEach(() => {    
    const element = document.createElement(<%= data.componentConstantName %>_CONSTANTS.elementName);
    fixtureContainer.appendChild(element);
    componentInstance = document.querySelector(<%= data.componentConstantName %>_CONSTANTS.elementName) as <%= data.componentClassName %>Component;
  });

  afterEach(() => {
    fixtureContainer.removeChild(componentInstance);
  });

  it('should instantiate component instance', () => {
    expect(componentInstance.shadowRoot).not.toBeNull();
  });  
});
