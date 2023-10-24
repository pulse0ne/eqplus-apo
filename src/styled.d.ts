import 'styled-components';
import { Theme } from '../common/types/theme';

declare module 'styled-components' {
  export interface DefaultTheme extends Theme {}
}
