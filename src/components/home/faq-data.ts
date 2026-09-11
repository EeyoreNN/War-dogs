/** The five FAQ items (§4.1). The FAQPage JSON-LD (§6.4) mirrors these exactly. */
export const FAQ_ITEMS: readonly { q: string; a: string }[] = [
  {
    q: "Do my squadmates need to install anything?",
    a: "No. One admin adds it to the server once. Everyone else presses Start an Activity in the voice call, or opens the link in a browser.",
  },
  {
    q: "Does it work outside Discord?",
    a: "Yes. Open a war room here, copy the link, paste it anywhere. The Discord Activity is the convenient way in, not the only one.",
  },
  {
    q: "Do you store our plans?",
    a: "Plans live in your browser and, if a relay is configured, in the relay's memory while the room is active. There is no account and no database. Export a PNG or a plan file if you want to keep one.",
  },
  {
    q: "Which maps?",
    a: "Zestafona, Bakurani and Ozeti as schematic maps drawn by the site, with the control zones in place. Commanders can upload their own map image.",
  },
  {
    q: "Is it free?",
    a: "Yes. Fan-made, no ads, no sign-up. Not affiliated with Bulkhead or Team17.",
  },
];

export function faqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}
