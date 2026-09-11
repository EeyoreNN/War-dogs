import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Download } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { CopyButton } from "@/components/ui/copy-button";
import { CodeBlock, DocTable } from "@/components/docs/CodeBlock";
import { EndpointTable } from "@/components/docs/EndpointTable";
import { Stats } from "@/components/docs/Stats";
import { INI_KEYS, INI_SECTIONS } from "@/lib/config-ini/validate";
import { getSpec } from "@/lib/openapi/match";
import { RCON_PROMPT } from "./rcon-prompt";
import type { Doc } from "./types";

const spec = getSpec();

/* The upstream reference text (Appendix D), ported where it is factual; the endpoint table and
   the config key table are generated so the docs cannot drift from the spec and the validator. */
export const rconReference: Doc = {
  slug: "rcon-reference",
  title: "Wardogs Server Reference",
  eyebrow: "Unofficial · Community reference",
  unofficialLine: "Not official Wardogs docs, not affiliated with the devs, and may change.",
  jsonLd: "TechArticle",
  intro: (
    <>
      <p>
        A community reference for running a Wardogs dedicated server: the RCON HTTP API and the
        ServerSettings.ini config, in one place. Unofficial.
      </p>
      <Stats
        items={[
          { label: "RCON API", value: `/v1 · ${spec.endpoints.length} endpoints` },
          { label: "Auth", value: "Bearer token" },
          { label: "Transport", value: "HTTP · TLS for remote" },
          { label: "Config", value: "ServerSettings.ini" },
        ]}
      />
    </>
  ),
  sections: [
    {
      id: "01",
      title: "Overview",
      body: (
        <>
          <p>
            Two references in one: the RCON HTTP API (everything under <code>/v1</code>, one bearer
            token) and the ServerSettings.ini config the server reads at startup.
          </p>
          <p>
            Servers vary in what they enable. <code>GET /v1/capabilities</code> lists what a given
            one supports, so check there rather than assume.
          </p>
          <p>
            Building with an AI assistant? <a href="#09">Grab the copy-paste version</a> for Claude
            or ChatGPT.
          </p>
        </>
      ),
    },
    {
      id: "02",
      title: "Base URL & transport",
      body: (
        <>
          <p>
            Requests go to the server&apos;s RCON host and port. The scheme depends on how the
            listener is bound:
          </p>
          <CodeBlock
            lang="http"
            filename="base url"
            code={`// loopback listener (BindAddress=127.0.0.1) — plaintext allowed
http://<host>:<port>/v1/…

// network listener (BindAddress=0.0.0.0) — TLS required
https://<host>:<port>/v1/…`}
          />
          <p>
            Any server you reach remotely is bound to the network, and a network-exposed RCON
            listener requires TLS (and a hashed password) to start. Plain HTTP is only for a
            loopback listener on the box itself. The default RCON port is <code>7776</code>{" "}
            (settable in config or with <code>-RCONPort=</code>).
          </p>
          <p>
            Bodies and responses are JSON (<code>Content-Type: application/json</code>). The two
            config-document endpoints are the exception: they send and receive{" "}
            <code>text/plain</code>.
          </p>
          <p>
            A browser page can call a TLS server directly. It can&apos;t call a plaintext loopback
            listener from an HTTPS page (mixed content is blocked), so for local/plaintext setups
            call from a server.
          </p>
        </>
      ),
    },
    {
      id: "03",
      title: "Authentication",
      body: (
        <>
          <p>Send the RCON password as a bearer token on every request:</p>
          <CodeBlock lang="http" filename="header" code={`Authorization: Bearer <rcon-password>`} />
          <p>
            There&apos;s no separate login step. To check a connection, call{" "}
            <code>GET /v1/status</code>; if it succeeds, the token is good.
          </p>
          <Callout tone="danger" title="One token, full access">
            The same token authorizes every endpoint, read and write. That includes kick, ban,
            config replacement, and ending a match. There&apos;s no read-only key, so treat it as a
            full-access secret and keep it server-side.
          </Callout>
        </>
      ),
    },
    {
      id: "04",
      title: "Conventions",
      body: (
        <>
          <h3 id="errors">Errors</h3>
          <p>Failures return a non-2xx status with a JSON body:</p>
          <CodeBlock
            lang="json"
            filename="error body"
            code={`{ "error": { "code": string, "message": string } }`}
          />
          <p>
            The config write endpoints return <code>412</code> when your revision is out of date
            (see <a href="#06">Response shapes</a>).
          </p>
          <h3 id="feature-detection">Feature detection</h3>
          <p>
            <code>GET /v1/capabilities</code> tells you which routes a server supports:
          </p>
          <CodeBlock
            lang="json"
            filename="GET /v1/capabilities"
            code={`{
  "routes": string[],            // e.g. "PATCH /v1/players/{id}"
  "config": { "writable": boolean }
}`}
          />
          <p>
            The admin panel uses exactly this: it shows &ldquo;change team&rdquo; only when{" "}
            <code>PATCH /v1/players/{"{id}"}</code> is in <code>routes</code>, and the config editor
            only when <code>config.writable</code> is true.
          </p>
        </>
      ),
    },
    {
      id: "05",
      title: "Endpoints",
      body: (
        <>
          <p>
            The full <code>/v1</code> surface. Path parameters are in amber, and request bodies are
            noted where an endpoint takes one. Filter by access or search by path, method, or
            description. Every row opens that endpoint in the console.
          </p>
          <div className="not-prose rounded-md border border-line bg-bg-1 p-4 sm:p-5">
            <Link
              href="/rcon-api"
              className="inline-flex items-center gap-2 text-[15px] font-semibold text-fg underline decoration-accent/60 underline-offset-4 hover:text-accent"
            >
              <ArrowUpRight size={16} aria-hidden="true" />
              Open the interactive API console
            </Link>
            <p className="mt-1 text-[14px] text-fg-muted">
              Every endpoint with a form, a live request preview and a response, backed by the
              OpenAPI spec (
              <a href="/openapi.json" className="text-fg underline underline-offset-4">
                openapi.json
              </a>
              ). Try it against the in-browser simulator or your own server, and generate a client
              in any language.
            </p>
          </div>
          <EndpointTable endpoints={spec.endpoints} />
        </>
      ),
    },
    {
      id: "06",
      title: "Response shapes",
      body: (
        <>
          <p>
            The fields you can count on in each response. Servers may include more, but these are
            the ones the panel reads and relies on.
          </p>
          <h3 id="shape-status">GET /v1/status</h3>
          <CodeBlock
            lang="json"
            filename="GET /v1/status"
            code={`{
  serverName: string,
  map: string,                       // map id, e.g. "Kavkazi"
  experiences: string[],
  lighting: string,
  alternator: string,
  scoreTick: { current, min, max },
  scoreCap: number,
  matchSeconds: number,
  players: { current, max },
  factionScores: [ { name, colorHex, … } ],   // one row per faction
  rotation: { nowIndex, nextIndex }           // integer, or null
}`}
          />
          <h3 id="shape-players">GET /v1/players</h3>
          <CodeBlock
            lang="json"
            filename="GET /v1/players"
            code={`{ players: [ { name, steamId, faction, kills, deaths, cash, pingMs } ] }`}
          />
          <p>
            <code>faction</code> is a server-defined name; match it to a faction row by{" "}
            <code>colorHex</code> from <code>factionScores</code>. Steam names and avatars
            aren&apos;t here, see <a href="#07">Player names</a>.
          </p>
          <h3 id="shape-rotation">GET /v1/rotation</h3>
          <CodeBlock
            lang="json"
            filename="GET /v1/rotation"
            code={`{
  enabled: boolean,
  mode: string,                      // "ordered" | "random"
  entries: [ {
    map, experiences[], lighting,
    zoneAlternator,
    status,                          // "now" | "next" | …
    denied: boolean
  } ]
}`}
          />
          <h3 id="shape-bans">GET /v1/bans</h3>
          <CodeBlock
            lang="json"
            filename="GET /v1/bans"
            code={`{ bans: [ { steamId, bannedAtUtc, bannedBy, reason } ] }`}
          />
          <h3 id="shape-reserved">GET /v1/reserved-slots</h3>
          <CodeBlock
            lang="json"
            filename="GET /v1/reserved-slots"
            code={`{ reservedSlots: string[] }   // array of steamId strings`}
          />
          <h3 id="shape-audit">GET /v1/audit?limit=N</h3>
          <CodeBlock
            lang="json"
            filename="GET /v1/audit"
            code={`{ entries: [ { timestampUtc, peer, sessionId, event, detail } ] }
// limit 1–500, default 50`}
          />
          <h3 id="shape-config">GET /v1/config</h3>
          <CodeBlock
            lang="json"
            filename="GET /v1/config"
            code={`{
  revision: string,
  writable: boolean,
  text: string,                      // the config document
  sections: [ … ],
  warnings: [ … ]
}`}
          />
          <h3 id="shape-config-result">PUT /v1/config &amp; POST /v1/config/validate — result</h3>
          <CodeBlock
            lang="json"
            filename="config result"
            code={`{
  ok: boolean, revision: string,
  error: { code, message },
  outcomes: [], shadowed: [], stripped: [], errors: [], changed: [],
  conflict: [],                      // present on HTTP 412 (revision mismatch)
  warnings: [], timingsMs: object|null
}`}
          />
          <p>
            Send the document as the raw request body with <code>Content-Type: text/plain</code>.
            Pass the current <code>revision</code> as an{" "}
            <code>If-Match: &quot;&lt;revision&gt;&quot;</code> header for safe concurrent edits; a
            stale revision returns <code>412</code>. Optional query params: <code>force=true</code>,{" "}
            <code>fullApply=true</code>.
          </p>
        </>
      ),
    },
    {
      id: "07",
      title: "Player names",
      body: (
        <>
          <p>
            <code>/v1/players</code> gives you each player&apos;s in-game <code>name</code> and{" "}
            <code>steamId</code>. It does not give avatars or Steam profile names; resolve those
            yourself against the Steam Web API if you want them.
          </p>
          <p>
            Call <code>ISteamUser/GetPlayerSummaries</code> with your own Steam Web API key, passing
            the <code>steamId</code> values from <code>/v1/players</code>. Batch them and cache the
            results, since profile names change rarely.
          </p>
          <p>
            The admin panel does the same thing through a small proxy on its own host (
            <code>GET /api/steam/profiles?ids=…</code>, key in an <code>X-Steam-Api-Key</code>{" "}
            header, up to 32 ids per call, returning{" "}
            <code>{'{ "<steamId>": { name, avatar } }'}</code>). That proxy isn&apos;t part of the
            game server API, so most tools just call Steam directly.
          </p>
        </>
      ),
    },
    {
      id: "08",
      title: "ServerSettings.ini",
      body: (
        <>
          <p>
            The dedicated server reads a single config file at startup. Only whitelisted sections
            and keys are honored — anything else is stripped. Omitted keys keep their default. RCON
            commands for bans, reserved slots, and rotation edit this file and persist back to it.
          </p>
          <div className="not-prose flex flex-col gap-3 rounded-md border border-line bg-bg-1 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <p className="text-[15px] font-semibold text-fg">
                Download a starter ServerSettings.ini
              </p>
              <p className="mt-1 text-[14px] text-fg-muted">
                A commented template with every key at its default. Edit it and drop it in your
                server&apos;s config location, or{" "}
                <Link href="/dev#validate" className="text-fg underline underline-offset-4">
                  validate yours
                </Link>{" "}
                first.
              </p>
            </div>
            <a
              href="/ServerSettings.ini"
              download
              className={buttonClasses("secondary", "md", "shrink-0")}
            >
              <Download size={16} aria-hidden="true" />
              ServerSettings.ini
            </a>
          </div>
          <h3 id="rcon-listener">The RCON listener</h3>
          <p>This section decides whether, where, and how you can connect at all:</p>
          <CodeBlock
            lang="ini"
            filename="ServerSettings.ini"
            code={`[/Script/WDRCON.WDRCONSettings]
bEnabled=true         ; listener is OFF by default
BindAddress=127.0.0.1 ; loopback = plaintext ok; 0.0.0.0 = all interfaces, needs TLS
Port=7776             ; default; or launch with -RCONPort=
Password=             ; plaintext; if empty, auto-generated to Saved/RCON/ADMIN-PASSWORD.txt
PasswordHash=""       ; from \`WardogsServer -GenerateRCONHash=\`; wins over Password`}
          />
          <p>
            A network-facing listener (<code>0.0.0.0</code>) will not start without a TLS cert and
            key, and uses <code>PasswordHash</code>. Loopback may use a plaintext{" "}
            <code>Password</code>. That is the whole auth model: the password (or the password
            behind the hash) is the bearer token.
          </p>
          <h3 id="every-key">Every honored key</h3>
          <DocTable
            caption="Every honored ServerSettings.ini key"
            head={["Key", "Default", "Applies", "What it does"]}
          >
            {INI_SECTIONS.map((section) => (
              <React.Fragment key={section.name}>
                <tr className="group-row">
                  <td colSpan={4}>
                    {section.label}{" "}
                    <span className="tracking-normal text-fg-muted normal-case">
                      [{section.name}]
                    </span>
                  </td>
                </tr>
                {INI_KEYS.filter((k) => k.section === section.name).map((k) => (
                  <tr key={k.key}>
                    <td>
                      <code className="text-accent">{k.key}</code>
                    </td>
                    <td>
                      <code>{k.default}</code>
                    </td>
                    <td className="whitespace-nowrap">{k.applies}</td>
                    <td>{k.description}</td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </DocTable>
          <h3 id="rotation-entry-format">Rotation entry format</h3>
          <CodeBlock
            lang="ini"
            filename="+RotationEntries"
            code={`+RotationEntries=(Map="Kavkazi",Experience="Bakurani_KOTH_01",Lighting="DayClear",ZoneAlternator="ZoneAlternator.Factory.Circle")
+RotationEntries=(Map="Europe",Experiences="Madrid_KOTH_01+KOTH_InfantryOnly",Lighting="DayLateGray")`}
          />
          <p>
            <code>Experience</code> (singular) is one; <code>Experiences</code> (plural) joins
            several with <code>+</code>. <code>ZoneAlternator</code> is optional — omit it for the
            map&apos;s authored default.
          </p>
        </>
      ),
    },
    {
      id: "09",
      title: "Prompt for AI tools",
      body: (
        <>
          <p>
            Building with Claude or ChatGPT? Copy the block below and paste it in as context.
            It&apos;s the whole API in plain text, so your assistant can write correct requests
            against it without guessing.
          </p>
          <figure className="not-prose overflow-hidden rounded-md border border-line bg-bg-0">
            <figcaption className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-bg-1/70 py-2 pr-2 pl-3">
              <span className="font-mono text-[11px] tracking-[0.14em] text-fg-muted uppercase">
                Paste into Claude / ChatGPT
              </span>
              <CopyButton
                text={RCON_PROMPT}
                label="Copy for Claude / ChatGPT"
                variant="secondary"
                size="sm"
              />
            </figcaption>
            <pre
              tabIndex={0}
              className="max-h-[32rem] scrollbar-thin overflow-auto p-4 font-mono text-[12.5px] leading-relaxed [overflow-wrap:anywhere] whitespace-pre-wrap text-fg-muted"
            >
              <code>{RCON_PROMPT}</code>
            </pre>
          </figure>
        </>
      ),
    },
    {
      id: "10",
      title: "Notes",
      body: (
        <ul>
          <li>
            <strong>Check capabilities per server.</strong> Not every server enables every route.{" "}
            <code>GET /v1/capabilities</code> is the real list for the server you&apos;re talking
            to.
          </li>
          <li>
            <strong>Poll gently.</strong> There&apos;s no published rate limit. A few seconds
            between calls is plenty for live status; the panel itself refreshes on a 3–5 second
            cadence.
          </li>
          <li>
            <strong>Match factions by color.</strong> A player&apos;s <code>faction</code> is a
            name; the stable key across a server is the <code>colorHex</code> on each{" "}
            <code>factionScores</code> row.
          </li>
          <li>
            <strong>Keep the token off the client.</strong> Since the token is the full-access RCON
            password, requests belong on a server you control, never in a browser.
          </li>
        </ul>
      ),
    },
  ],
};
