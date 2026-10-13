import type { AdminJSOptions } from 'adminjs';

export const adminBranding = {
  companyName: 'tsoadmin',
  logo: false,
  withMadeWithLove: false,
  theme: {
    colors: {
      primary100: '#2563eb',
      primary80: '#3b82f6',
    },
  },
} satisfies NonNullable<AdminJSOptions['branding']>;

export const adminLocale = {
  language: 'en',
  translations: {
    en: {
      components: {
        Login: {
          welcomeHeader: 'Welcome to tsoadmin',
          welcomeMessage: 'Sign in to manage your application.',
        },
      },
    },
  },
} satisfies NonNullable<AdminJSOptions['locale']>;
