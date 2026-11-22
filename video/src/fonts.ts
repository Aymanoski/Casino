import { loadFont as loadLilitaOne } from '@remotion/google-fonts/LilitaOne';
import { loadFont as loadBebasNeue } from '@remotion/google-fonts/BebasNeue';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadLalezar } from '@remotion/google-fonts/Lalezar';
import { loadFont as loadCairo } from '@remotion/google-fonts/Cairo';

const lilita = loadLilitaOne('normal', { weights: ['400'], subsets: ['latin'] });
const bebas = loadBebasNeue('normal', { weights: ['400'], subsets: ['latin'] });
const inter = loadInter('normal', {
  weights: ['500', '600', '700', '800'],
  subsets: ['latin'],
});
const lalezar = loadLalezar('normal', {
  weights: ['400'],
  subsets: ['arabic', 'latin'],
});
const cairo = loadCairo('normal', {
  weights: ['600', '700', '900'],
  subsets: ['arabic', 'latin'],
});

export const FONTS = {
  displayEn: lilita.fontFamily,
  scoreEn: bebas.fontFamily,
  bodyEn: inter.fontFamily,
  displayAr: lalezar.fontFamily,
  bodyAr: cairo.fontFamily,
  scoreAr: cairo.fontFamily,
} as const;
