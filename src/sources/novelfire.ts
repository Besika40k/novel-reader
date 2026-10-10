import icon from '@/assets/sites/novelfire.png';
import { lightNovelPubSource } from './lightnovelpub';

export const novelfire = lightNovelPubSource({
  id: 'novelfire',
  name: 'NovelFire',
  base: 'https://novelfire.net',
  icon,
  novelPath: 'book',
});
