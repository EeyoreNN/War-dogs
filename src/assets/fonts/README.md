# OG renderer fonts

TrueType copies of the two brand faces, read by `src/lib/og/render.tsx` with literal paths so
Vercel's file tracing bundles them. Satori (`next/og`) cannot read woff2, which is why these are
not the `src/app/fonts` files used by `next/font/local`.

| File                           | Source                                        | Licence                                |
| ------------------------------ | --------------------------------------------- | -------------------------------------- |
| `SairaCondensed-ExtraBold.ttf` | github.com/google/fonts, `ofl/sairacondensed` | SIL OFL 1.1 (`OFL-SairaCondensed.txt`) |
| `Barlow-Medium.ttf`            | github.com/google/fonts, `ofl/barlow`         | SIL OFL 1.1 (`OFL-Barlow.txt`)         |

Both fonts are used unmodified. The Reserved Font Names ("Saira", "Barlow") are not used to name
any derived font software.
