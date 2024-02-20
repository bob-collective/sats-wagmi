import type { Preview } from '@storybook/react';

import '@interlay/theme/dist/bob.css';
import { CSSReset, InterlayUIProvider } from '@interlay/ui';
import React from 'react';

import { WagmiConfig } from '../packages/wagmi/src';
import { SatsWagmiConfig } from '../packages/sats-wagmi/src';
import './style.css';

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/
      }
    }
  },
  decorators: [
    (Story, { globals: { locale } }) => {
      const direction =
        // @ts-ignore
        locale && new Intl.Locale(locale)?.textInfo?.direction === 'rtl' ? 'rtl' : undefined;

      return (
        <WagmiConfig>
          <SatsWagmiConfig network='testnet'>
            <InterlayUIProvider locale={locale}>
              <CSSReset />
              <div dir={direction} lang={locale}>
                <Story />
              </div>
            </InterlayUIProvider>
          </SatsWagmiConfig>
        </WagmiConfig>
      );
    }
  ]
};

export default preview;
