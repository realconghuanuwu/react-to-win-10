import { webDarkTheme, type Theme } from '@fluentui/react-components';

/**
 * Windows 10 dark shell theme extending Fluent UI v9 dark tokens.
 */
export const win10Theme: Theme = {
  ...webDarkTheme,
  fontFamilyBase: '"Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif',
  borderRadiusNone: '0px',
  borderRadiusSmall: '0px',
  borderRadiusMedium: '0px',
  borderRadiusLarge: '2px',
  colorNeutralBackground1: '#2b2b2b',
  colorNeutralBackground1Hover: '#414141',
  colorNeutralBackground1Pressed: '#4b4b4b',
  colorNeutralStroke1: '#454545',
  colorNeutralForeground1: '#ffffff',
};
