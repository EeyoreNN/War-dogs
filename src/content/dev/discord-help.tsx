import * as React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { DocTable } from "@/components/docs/CodeBlock";
import { buttonClasses } from "@/components/ui/button";
import { site } from "@/config/site";
import type { Doc } from "./types";

/* The upstream article (Appendix D), ported verbatim, with the one edit §4.9 asks for in
   "Things that are not the problem". The "Start here" stepper sits above it on the page. */
export const discordHelp: Doc = {
  slug: "discord-help",
  title: "It won’t launch",
  eyebrow: "Discord help",
  unofficialLine: "Fan-made community tool. Not affiliated with the Wardogs developers.",
  jsonLd: "TechArticle",
  intro: (
    <p>
      You added wardogs.tech to your server, you can open it yourself, and your members cannot.
      Almost every version of this is one Discord permission, in a place nobody thinks to look.
      Start at the top.
    </p>
  ),
  sections: [
    {
      id: "answer",
      title: "The answer, nine times out of ten",
      body: (
        <>
          <blockquote>
            A permission on the voice channel beats the permission on the role — and administrators
            bypass it.
          </blockquote>
          <p>
            So you test it, it works, and you conclude the app is fine. It is. What is not fine is{" "}
            <code>Use Activities</code> on the channel your members are sitting in. Because you are
            an admin, you will never see the failure yourself.
          </p>
          <p>
            Check <strong>Edit Channel → Permissions</strong> on the voice channel{" "}
            <strong>and on the category above it</strong>. If <code>Use Activities</code> is a red
            deny for <code>@everyone</code> or for their role, that is your bug. Set it to neutral
            or allow.
          </p>
        </>
      ),
    },
    {
      id: "temp-channels",
      title: "Temp voice channels",
      body: (
        <>
          <p>
            If your server creates voice channels on demand — a &ldquo;join to create&rdquo; hub, or
            any temp-channel bot — read this before anything else, because fixing the symptom does
            not hold.
          </p>
          <p>
            Those channels are clones. The bot copies the permission overwrites of a hub or template
            channel every time it makes a new one. If the hub denies <code>Use Activities</code>,
            every channel it spawns is born denying it. You can fix a live temp channel, launch the
            map happily, and then the next channel your members create is broken again — which looks
            exactly like the app being flaky.
          </p>
          <p>
            <strong>Fix the hub, not the children.</strong> Find the channel your bot clones from
            (its configuration will name it — often a category template, or the &ldquo;join to
            create&rdquo; channel itself) and clear the deny there. Then delete an existing temp
            channel and let the bot make a fresh one to confirm it inherited the fix.
          </p>
          <p>
            Some temp bots also give the channel&apos;s creator extra permissions the other
            occupants do not get. That produces a very specific symptom: whoever made the channel
            can launch, and nobody who joins it can.
          </p>
        </>
      ),
    },
    {
      id: "one-minute-test",
      title: "The test that finds it in one minute",
      body: (
        <>
          <p>
            Do not change any more settings until you have run this. It separates &ldquo;a channel
            problem&rdquo; from &ldquo;a server problem&rdquo; and takes about a minute.
          </p>
          <ol>
            <li>
              Create a <strong>new permanent voice channel</strong>.
            </li>
            <li>
              Drag it to the <strong>very top of the server, outside every category</strong>, so it
              inherits nothing.
            </li>
            <li>Do not touch its permissions.</li>
            <li>Have someone who is not an admin join it and try to launch the map.</li>
          </ol>
          <h3 id="works-there">Works there, fails elsewhere</h3>
          <p>
            It is a channel or category permission on the channel that failed. Go back to{" "}
            <a href="#answer">
              <code>Use Activities</code> above
            </a>{" "}
            — and if the failing channel is a temp one, <a href="#temp-channels">fix the hub</a>.
          </p>
          <h3 id="fails-there">Fails there too</h3>
          <p>
            It is <strong>server-wide</strong>. Check{" "}
            <strong>Server Settings → Apps → Activities</strong> — a different page from
            Integrations — and the app&apos;s own access list under{" "}
            <strong>Integrations → wardogs.tech → Manage</strong>.
          </p>
        </>
      ),
    },
    {
      id: "what-you-see",
      title: "What you are looking at",
      body: (
        <>
          <p>
            Three different failures look similar and mean opposite things. Matching yours to the
            right row saves you an afternoon.
          </p>
          <DocTable
            caption="Symptoms and what they mean"
            head={["What the person sees", "What it means", "What to do"]}
          >
            <tr>
              <td>
                A card with our logo, tags and a description, and <strong>no Launch button</strong>
              </td>
              <td>
                That is Discord&apos;s app listing — what an app you do not have looks like. It is
                not installed for that person.
              </td>
              <td>
                An admin installs it to the server (<a href="#installing">below</a>). Or, right now
                with no admin: the three dots → <strong>Add to my apps</strong>.
              </td>
            </tr>
            <tr>
              <td>
                &ldquo;<strong>Failed to Launch Activity</strong>&rdquo; / &ldquo;Unable to launch
                activity&rdquo;
              </td>
              <td>
                The app is available to them. Something refused the launch, which means permissions.
              </td>
              <td>
                <code>Use Activities</code> on the channel and its category.
              </td>
            </tr>
            <tr>
              <td>&ldquo;You do not have permissions to use activities in this channel&rdquo;</td>
              <td>Discord telling you the answer outright.</td>
              <td>Same — and if it is a temp channel, fix the hub it was cloned from.</td>
            </tr>
            <tr>
              <td>
                No <strong>Start an Activity</strong> button at all (no rocket)
              </td>
              <td>Either they are not in a voice channel, or activities are denied on it.</td>
              <td>Join the voice channel first. Then check the channel permission.</td>
            </tr>
            <tr>
              <td>Works for the owner, nobody else, in every channel</td>
              <td>You are an admin and admins bypass channel denies.</td>
              <td>
                Run the <a href="#one-minute-test">one-minute test</a> above. Never test this as an
                admin.
              </td>
            </tr>
          </DocTable>
        </>
      ),
    },
    {
      id: "installing",
      title: "Installing it, properly",
      body: (
        <>
          <p>
            There are two doors and they do different things. Picking the wrong one is a quiet way
            to end up supporting one person instead of a server.
          </p>
          <DocTable
            caption="The two ways to install"
            head={["Door", "Who ends up with it", "Use it when"]}
          >
            <tr>
              <td>
                <strong>Add to your server</strong>
                <br />
                <Link href="/add" className="font-mono text-[13px]">
                  {site.name}/add
                </Link>
              </td>
              <td>
                Everyone in that server. No bot joins the server, and there are no permissions to
                approve.
              </td>
              <td>
                <strong>Always, if you can.</strong> This is the one you want.
              </td>
            </tr>
            <tr>
              <td>
                <strong>Add to my apps</strong>
                <br />
                <span className="text-[13px]">three dots on the app card</span>
              </td>
              <td>Only you — but in every server you are in.</td>
              <td>
                Your admin will not add it, or you need it working in the next thirty seconds.
              </td>
            </tr>
          </DocTable>
          <p>
            To tell which one a server has: <strong>Server Settings → Integrations</strong>. A
            server install is listed there, with who added it and when. A personal install is listed
            for nobody — so if it works for one person and the list is empty, that is your
            explanation.
          </p>
        </>
      ),
    },
    {
      id: "not-the-problem",
      title: "Things that are not the problem",
      body: (
        <>
          <p>
            All of these have been checked, more than once, and cost real hours. If you are being
            told one of these is the cause, it is not.
          </p>
          <DocTable
            caption="Suspicions that are not the cause"
            head={["Suspicion", "Why it is not that"]}
          >
            <tr>
              <td>The app is broken, or down</td>
              <td>A whole-app failure would affect every server, not one.</td>
            </tr>
            <tr>
              <td>It does not support phones</td>
              <td>
                It does. A phone that cannot launch is hitting the same channel permission a desktop
                would.
              </td>
            </tr>
            <tr>
              <td>Your roles are set up wrong</td>
              <td>
                Probably not — and a channel deny would beat them even if they were perfect. Check
                the channel first, the roles second.
              </td>
            </tr>
            <tr>
              <td>The app needs more permissions</td>
              <td>It asks for none. No bot joins your server. There is nothing to grant it.</td>
            </tr>
          </DocTable>
        </>
      ),
    },
    {
      id: "still-stuck",
      title: "Still stuck",
      body: (
        <>
          <p>
            Bring us the result of the one-minute test — that one fact narrows it further than any
            description of the symptom can. Tell us your server, whether the person failing is an
            admin, and whether the channel is permanent or auto-created.
          </p>
          <p className="not-prose">
            <a
              href={site.links.discord}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClasses("secondary")}
            >
              Our Discord <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          </p>
        </>
      ),
    },
  ],
};
