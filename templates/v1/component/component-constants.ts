import { COMPONENT_NAME_PREFIX } from '<%= data.prefixImportPath %>/constants';

const elementName = `${COMPONENT_NAME_PREFIX}<%= data.componentName %>`;

export const <%= data.componentConstantName %>_CONSTANTS = {
  elementName
};
