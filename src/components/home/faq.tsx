import { ChevronDown } from "lucide-react";
import { Container } from "@/components/ui/container";
import { FAQ_ITEMS } from "./faq-data";
import { Rise } from "@/components/site/motion";

/** Five native `<details>` disclosures (§4.1): no script, keyboard and screen-reader ready. */
export function Faq() {
  return (
    <section
      id="faq"
      aria-labelledby="faq-title"
      className="[scroll-margin-top:96px] py-[clamp(4rem,8vw,7rem)]"
    >
      <Container className="max-w-3xl">
        <Rise>
          <p className="mb-3 eyebrow">Questions</p>
          <h2 id="faq-title" className="display display-2 text-fg">
            Before you add it
          </h2>
        </Rise>
        <Rise index={1} className="mt-8 border-t border-line">
          {FAQ_ITEMS.map((item) => (
            <details key={item.q} className="group border-b border-line">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-[17px] font-semibold text-fg transition-colors hover:text-accent [&::-webkit-details-marker]:hidden">
                {item.q}
                <ChevronDown
                  size={18}
                  aria-hidden="true"
                  className="shrink-0 text-fg-muted transition-transform duration-200 group-open:rotate-180"
                />
              </summary>
              <p className="pb-5 text-fg-muted">{item.a}</p>
            </details>
          ))}
        </Rise>
      </Container>
    </section>
  );
}
