import { Rocket, ScreenShare, Video } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { DiscordIcon } from "@/components/ui/icons";
import { LogoMark } from "@/components/ui/logo";
import { Rise } from "@/components/site/motion";

/* Card media 01: the primary button, as a picture. */
function AddButtonMock() {
  return (
    <div aria-hidden="true" className={buttonClasses("primary", "lg", "pointer-events-none")}>
      <DiscordIcon size={18} />
      Add to your server
    </div>
  );
}

/* Card media 02: an original drawing of a voice-call toolbar — three round buttons, a rocket in
   the middle and its tooltip. Not a Discord screenshot. */
function ActivityToolbarMock() {
  const round =
    "flex h-11 w-11 items-center justify-center rounded-full bg-[#3b3f46] text-[#e3e5e8]";
  return (
    <div aria-hidden="true" className="relative flex flex-col items-center">
      <div className="relative mb-3 rounded-md bg-[#111214] px-3 py-1.5 text-[13px] font-semibold text-[#f2f3f5] shadow-[0_8px_16px_rgba(0,0,0,0.4)]">
        Start an Activity
        <span className="absolute top-full left-1/2 -ml-1.5 border-x-[6px] border-t-[6px] border-x-transparent border-t-[#111214]" />
      </div>
      <div className="flex items-center gap-3 rounded-full bg-[#2b2d31] px-3 py-2">
        <span className={round}>
          <Video size={20} />
        </span>
        <span
          className={`${round} bg-[#5865F2] text-white ring-2 ring-white/70 ring-offset-2 ring-offset-[#2b2d31]`}
        >
          <Rocket size={20} />
        </span>
        <span className={round}>
          <ScreenShare size={20} />
        </span>
      </div>
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        className="absolute bottom-[-6px] left-[calc(50%+8px)] drop-shadow-[0_2px_2px_rgba(0,0,0,0.6)]"
      >
        <path
          d="M5 3l14 8.5-6.2 1.3L16 20l-3 1.4-3.2-7.1L5 18z"
          fill="#fff"
          stroke="#111"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

/* Card media 03: the app's own top bar. */
function TopBarMock() {
  return (
    <div
      aria-hidden="true"
      className="flex w-full max-w-[320px] items-center gap-2 rounded-md border border-line-strong bg-bg-1 px-3 py-2 font-mono text-[11px] tracking-[0.14em] whitespace-nowrap text-fg-muted uppercase shadow-panel"
    >
      <LogoMark size={18} />
      <span className="hidden sm:inline">War room</span>
      <span className="rounded-sm border border-line-strong bg-bg-2 px-1.5 py-0.5 text-fg">
        ABC234
      </span>
      <span className="ml-auto inline-flex items-center gap-1.5 text-ok">
        <span className="h-1.5 w-1.5 animate-pulse-slow rounded-full bg-ok" />
        Live
      </span>
      <span className="text-fg-faint">·</span>
      <span>4 in room</span>
    </div>
  );
}

const STEPS = [
  {
    n: "01",
    title: "Add it to your server",
    body: "One click on the button above. That is the setup.",
    media: <AddButtonMock />,
  },
  {
    n: "02",
    title: "Press Start an Activity",
    body: "The rocket button in a voice call.",
    media: <ActivityToolbarMock />,
  },
  {
    n: "03",
    title: "Pick wardogs.tech",
    body: "Everyone in the call lands in the same room.",
    media: <TopBarMock />,
  },
];

/** Section 2 (§4.1): three tier-1 step cards with a ghost numeral. */
export function HowItWorks() {
  return (
    <section
      id="how"
      aria-labelledby="how-title"
      className="[scroll-margin-top:96px] py-[clamp(4rem,8vw,7rem)]"
    >
      <Container>
        <Rise>
          <p className="mb-3 eyebrow">How it works</p>
          <h2 id="how-title" className="display display-2 text-fg">
            Three clicks to a shared map
          </h2>
        </Rise>
        <ol className="mt-10 grid gap-4 md:grid-cols-3 md:gap-6" role="list">
          {STEPS.map((s, i) => (
            <Rise key={s.n} as="li" index={i} className="flex">
              <Card className="relative flex w-full flex-col overflow-hidden p-6">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute top-3 right-4 display text-[56px] leading-none text-fg opacity-10 select-none"
                >
                  {s.n}
                </span>
                <span className="font-mono text-[12px] tracking-[0.2em] text-accent">{s.n}</span>
                <h3 className="mt-3 display display-3 text-fg">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-fg-muted">{s.body}</p>
                <div className="mt-6 flex min-h-[152px] flex-1 items-center justify-center rounded-md border border-line bg-bg-0 p-5">
                  {s.media}
                </div>
              </Card>
            </Rise>
          ))}
        </ol>
      </Container>
    </section>
  );
}
