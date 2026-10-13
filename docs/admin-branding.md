# Admin branding

Branding and login translations are configured in `src/admin-branding.ts`, exported as `adminBranding` and `adminLocale`. The shared `src/admin.ts` imports these values when constructing AdminJS.

## Current settings

| Setting                 | Value                                                            |
| ----------------------- | ---------------------------------------------------------------- |
| Company name            | `tsoadmin`                                                       |
| Logo                    | Hidden with `logo: false`; the company name is displayed instead |
| Attribution footer      | Hidden with `withMadeWithLove: false`                            |
| Primary color           | `primary100: '#2563eb'`                                          |
| Secondary primary shade | `primary80: '#3b82f6'`                                           |
| Login heading           | `Welcome to tsoadmin`                                            |
| Login description       | `Sign in to manage your application.`                            |

## Customize

- Edit `adminBranding.companyName` to change the displayed name and page title.
- Set `adminBranding.logo` to a served image URL to replace the logo. A same-origin URL is simplest; serve the asset through an appropriate static route. External image hosts must also be allowed by the admin CSP in `src/security.ts`.
- Set `adminBranding.withMadeWithLove` to `true` to restore the attribution footer.
- Edit `adminBranding.theme.colors` to change the palette. Additional supported theme overrides can customize fonts, spacing, and other design tokens.
- Edit `adminLocale.translations.en.components.Login.welcomeHeader` and `welcomeMessage` to change the login text. Add equivalent translations when introducing other languages.

Restart the development server after changing these settings. For the compiled server, rebuild and restart. No additional theme package is required for the current color overrides.

The default AdminJS welcome dashboard still contains its own introductory content. Replacing that screen requires a custom dashboard component; these settings customize branding and login copy only.

AdminJS also supports named themes through `defaultTheme` and `availableThemes`, with optional public themes from `@adminjs/themes`. Those are an alternative to the current `adminBranding.theme` overrides; no additional themes have been installed.
