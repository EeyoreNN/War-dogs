"use client";

import * as React from "react";
import { Download, Search, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { CopyButton } from "@/components/ui/copy-button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Tabs, TabPanel } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { handleRcon, type SimResponse } from "@/lib/admin-sim/http";
import { getSpec } from "@/lib/openapi/match";
import {
  buildUrl,
  exampleFor,
  toCurl,
  toFetch,
  toPowerShell,
  type Endpoint,
  type Param,
} from "@/lib/openapi/parse";
import { validateIni } from "@/lib/config-ini/validate";
import { cn } from "@/lib/utils";
import { MethodBadge } from "@/components/admin/method-badge";
import { Select } from "@/components/admin/select";
import { SimProvider, useSim } from "@/components/admin/sim-provider";
import { SchemaTree } from "./schema-tree";
import {
  DEFAULT_TARGET,
  getTargetSnapshot,
  mixedContent,
  normaliseBase,
  saveTarget,
  subscribeTarget,
  type ConsoleTarget,
} from "./target";

/**
 * The API console (§4.9): every endpoint in the spec with a form, a live request preview and a
 * response. Targets the in-browser simulator by default (sharing the dashboard's command log,
 * so a kick here shows up on /demo/admin/live) or the visitor's own server.
 */

const SIM_BASE = "https://your-server-host:7776";
const REAL_TIMEOUT_MS = 10_000;
type Lang = "curl" | "fetch" | "powershell";

interface Outcome {
  status: number | null;
  statusText: string;
  ms: number;
  headers: Record<string, string>;
  body: string;
  simulated: boolean;
  error: string | null;
}

/* `?endpoint=` is read after mount from window.location (Next 16 rules, §3.14). */
const emptyQuery = () => "";
const subscribeLocation = (cb: () => void) => {
  window.addEventListener("popstate", cb);
  return () => window.removeEventListener("popstate", cb);
};
const readLocation = () => window.location.search;

function useQueryParam(name: string): string | null {
  const search = React.useSyncExternalStore(subscribeLocation, readLocation, emptyQuery);
  return React.useMemo(() => new URLSearchParams(search).get(name), [search, name]);
}

const subscribeNothing = () => () => {};
const serverTarget = () => DEFAULT_TARGET;
const readProtocol = () => window.location.protocol;
const serverProtocol = () => "https:";

function prettyJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

function initialBody(e: Endpoint, configText: string): string {
  if (!e.body) return "";
  if (e.body.contentType === "text/plain") return configText;
  return JSON.stringify(exampleFor(e.body.schema), null, 2);
}

function initialValues(e: Endpoint): Record<string, string> {
  const v: Record<string, string> = {};
  for (const p of e.params) {
    if (p.schema.default !== undefined) v[p.name] = String(p.schema.default);
    else if (p.in === "path")
      v[p.name] =
        p.name === "steamId" ? "" : p.name === "i" ? "0" : p.name === "id" ? "zestafona" : "";
    else v[p.name] = "";
  }
  return v;
}

export function ApiConsole({
  configText = "",
  className,
}: {
  /** The starter `ServerSettings.ini`; the page reads it with `fs`. Empty in isolated tests. */
  configText?: string;
  className?: string;
}) {
  return (
    <SimProvider>
      <ConsoleInner configText={configText} className={className} />
    </SimProvider>
  );
}

function ConsoleInner({ configText, className }: { configText: string; className?: string }) {
  const spec = React.useMemo(() => getSpec(), []);
  const { state, push } = useSim();
  const deepLink = useQueryParam("endpoint");
  const storedTarget = React.useSyncExternalStore(subscribeTarget, getTargetSnapshot, serverTarget);
  const protocol = React.useSyncExternalStore(subscribeNothing, readProtocol, serverProtocol);

  const [picked, setPicked] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const target = storedTarget;
  const [lang, setLang] = React.useState<Lang>("curl");
  const [forms, setForms] = React.useState<
    Record<string, { values: Record<string, string>; body: string }>
  >({});
  const [outcome, setOutcome] = React.useState<Outcome | null>(null);
  const [sending, setSending] = React.useState(false);
  const [testing, setTesting] = React.useState<{ ok: boolean; text: string } | null>(null);

  const selectedId =
    picked ??
    (deepLink && spec.endpoints.some((e) => e.id === deepLink) ? deepLink : spec.endpoints[0]?.id);
  const endpoint = spec.endpoints.find((e) => e.id === selectedId) ?? spec.endpoints[0];
  const form = forms[endpoint.id] ?? {
    values: initialValues(endpoint),
    body: initialBody(endpoint, configText),
  };

  const setTarget = (patch: Partial<ConsoleTarget>) => {
    saveTarget({ ...target, ...patch });
    setTesting(null);
  };
  const setValue = (name: string, v: string) =>
    setForms((f) => ({ ...f, [endpoint.id]: { ...form, values: { ...form.values, [name]: v } } }));
  const setBody = (body: string) => setForms((f) => ({ ...f, [endpoint.id]: { ...form, body } }));

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return spec.endpoints;
    return spec.endpoints.filter((e) =>
      `${e.method} ${e.path} ${e.summary} ${e.tag}`.toLowerCase().includes(q),
    );
  }, [spec.endpoints, query]);
  const groups = React.useMemo(
    () =>
      spec.tags
        .map((tag) => ({ tag, items: filtered.filter((e) => e.tag === tag) }))
        .filter((g) => g.items.length),
    [spec.tags, filtered],
  );

  const sim = target.mode === "sim";
  const base = sim ? SIM_BASE : normaliseBase(target.baseUrl) || SIM_BASE;
  const token = sim ? target.token || "demo" : target.token;
  const bodyValue = endpoint.body ? form.body : null;
  const snippets = React.useMemo(
    () => ({
      curl: toCurl(endpoint, base, token, form.values, bodyValue),
      fetch: toFetch(endpoint, base, token, form.values, bodyValue),
      powershell: toPowerShell(endpoint, base, token, form.values, bodyValue),
    }),
    [endpoint, base, token, form.values, bodyValue],
  );

  const mixed = !sim && mixedContent(target.baseUrl, protocol);
  const missingPath = endpoint.params.filter(
    (p) => p.in === "path" && !form.values[p.name]?.trim(),
  );
  const canSend =
    missingPath.length === 0 && (sim || (normaliseBase(target.baseUrl) !== "" && !mixed));

  const send = async () => {
    if (!canSend) return;
    setSending(true);
    const headers: Record<string, string> = {};
    for (const p of endpoint.params)
      if (p.in === "header" && form.values[p.name]) headers[p.name] = form.values[p.name];
    if (endpoint.body) headers["Content-Type"] = endpoint.body.contentType;
    headers.Authorization = `Bearer ${token}`;
    const relative = buildUrl(endpoint, "", form.values);
    if (sim) {
      const res: SimResponse = state
        ? handleRcon(
            { method: endpoint.method, path: relative, headers, body: bodyValue },
            { state, push, configText, validate: validateIni },
          )
        : {
            status: 503,
            headers: { "content-type": "application/json" },
            body: JSON.stringify(
              {
                error: { code: "not_ready", message: "The simulator is still booting; try again." },
              },
              null,
              2,
            ),
            ms: 1,
          };
      setOutcome({
        status: res.status,
        statusText: statusText(res.status),
        ms: res.ms,
        headers: res.headers,
        body: res.body,
        simulated: true,
        error: null,
      });
      setSending(false);
      return;
    }
    const url = normaliseBase(target.baseUrl) + relative;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REAL_TIMEOUT_MS);
    const started = performance.now();
    try {
      const res = await fetch(url, {
        method: endpoint.method.toUpperCase(),
        headers,
        body: bodyValue ?? undefined,
        signal: ctrl.signal,
        mode: "cors",
      });
      const text = await res.text();
      const h: Record<string, string> = {};
      res.headers.forEach((v, k) => (h[k] = v));
      setOutcome({
        status: res.status,
        statusText: res.statusText,
        ms: Math.round(performance.now() - started),
        headers: h,
        body: text,
        simulated: false,
        error: null,
      });
    } catch (err) {
      const reason =
        err instanceof DOMException && err.name === "AbortError"
          ? "timed out after 10 s"
          : "network error";
      setOutcome({
        status: null,
        statusText: "",
        ms: Math.round(performance.now() - started),
        headers: {},
        body: "",
        simulated: false,
        error: `No answer from ${normaliseBase(target.baseUrl)} (${reason}). The listener must be reachable from this browser and answer CORS preflights — otherwise copy the snippet and run it from a terminal.`,
      });
    } finally {
      clearTimeout(timer);
      setSending(false);
    }
  };

  const testConnection = async () => {
    const baseUrl = normaliseBase(target.baseUrl);
    if (!baseUrl || mixed) return;
    setTesting(null);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REAL_TIMEOUT_MS);
    try {
      const res = await fetch(`${baseUrl}/v1/status`, {
        headers: { Authorization: `Bearer ${target.token}` },
        signal: ctrl.signal,
        mode: "cors",
      });
      setTesting({
        ok: res.ok,
        text: res.ok
          ? `Connected: ${baseUrl} answered ${res.status}.`
          : `${baseUrl} answered ${res.status} ${res.statusText}. Check the token.`,
      });
    } catch (err) {
      const reason =
        err instanceof DOMException && err.name === "AbortError"
          ? "timed out after 10 s"
          : "network error";
      setTesting({
        ok: false,
        text: `No answer from ${baseUrl} (${reason}). The listener must be reachable from this browser and answer CORS preflights — otherwise copy the snippet and run it from a terminal.`,
      });
    } finally {
      clearTimeout(timer);
    }
  };

  const responseSchema = endpoint.responses.find((r) => r.status === "200")?.schema ?? null;

  return (
    <div className={cn("flex flex-col gap-6", className)} data-testid="api-console">
      {/* Target */}
      <section aria-labelledby="target-heading" className="panel p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 id="target-heading" className="label-mono text-fg-muted">
              Target
            </h2>
            <div
              className="mt-2 flex w-full flex-col rounded-md border border-line-strong bg-bg-0 p-1 sm:inline-flex sm:w-auto sm:flex-row"
              role="radiogroup"
              aria-label="Target"
            >
              {(
                [
                  ["sim", "Demo simulator (in this tab)"],
                  ["server", "Your server"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={target.mode === mode}
                  onClick={() => setTarget({ mode })}
                  className={cn(
                    "rounded-sm px-3 py-2.5 text-center font-mono text-[11px] tracking-[0.14em] uppercase transition-colors sm:py-2",
                    target.mode === mode
                      ? "bg-accent text-accent-ink"
                      : "text-fg-muted hover:text-fg",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-sm text-fg-muted">
              {sim
                ? "Any token works against the simulator. Writes land on the dashboard demo in this browser."
                : "Sent only to the host you type. Kept for this tab only."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <a
              href="/openapi.json"
              className="text-fg underline underline-offset-4 hover:text-accent"
            >
              openapi.json
            </a>
            <a
              href="/openapi.json"
              download="openapi.json"
              className="inline-flex items-center gap-1 text-fg underline underline-offset-4 hover:text-accent"
            >
              <Download size={14} aria-hidden="true" /> Download spec
            </a>
            <span className="font-mono text-[11px] tracking-[0.14em] text-fg-faint uppercase">
              v{spec.info.version} · {spec.endpoints.length} endpoints
            </span>
          </div>
        </div>

        {!sim ? (
          <div className="mt-5 grid gap-4 md:grid-cols-[2fr_1fr_auto] md:items-end">
            <Field label="Base URL" htmlFor="console-base">
              <Input
                value={target.baseUrl}
                placeholder="https://host:7776"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => setTarget({ baseUrl: e.target.value })}
                className="font-mono"
              />
            </Field>
            <Field label="Bearer token" htmlFor="console-token">
              <Input
                type="password"
                value={target.token}
                autoComplete="off"
                onChange={(e) => setTarget({ token: e.target.value })}
                className="font-mono"
              />
            </Field>
            <Button
              variant="secondary"
              className="h-12"
              onClick={testConnection}
              disabled={!normaliseBase(target.baseUrl) || mixed}
            >
              Test connection
            </Button>
            {mixed ? (
              <Callout tone="warning" className="md:col-span-3">
                A browser cannot call a plaintext listener from an HTTPS page. Use TLS, or call from
                a server. <a href="/rcon-reference#02">Read about transport</a>
              </Callout>
            ) : null}
            {testing ? (
              <Callout
                tone={testing.ok ? "note" : "danger"}
                className="md:col-span-3"
                title={testing.ok ? "Connected" : "Test connection failed"}
              >
                {testing.text}
              </Callout>
            ) : null}
            <Callout tone="note" className="md:col-span-3">
              Your listener must answer CORS preflights (Access-Control-Allow-Origin, -Headers:
              authorization, content-type) for a browser to call it. If it does not, copy the
              snippet and run it from a terminal.
            </Callout>
          </div>
        ) : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* Left nav */}
        <nav
          aria-label="Endpoints"
          className="flex max-h-[70vh] flex-col panel lg:sticky lg:top-16"
        >
          <form
            role="search"
            className="border-b border-line p-3"
            onSubmit={(e) => e.preventDefault()}
          >
            <label htmlFor="console-search" className="sr-only">
              Search endpoints
            </label>
            <div className="relative">
              <Search
                size={14}
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-faint"
              />
              <Input
                id="console-search"
                type="search"
                value={query}
                placeholder="Search method, path, summary"
                onChange={(e) => setQuery(e.target.value)}
                className="h-10 pl-9 text-sm"
              />
            </div>
          </form>
          <div className="min-h-0 flex-1 scrollbar-thin overflow-y-auto p-2">
            {groups.length === 0 ? (
              <p className="p-3 text-sm text-fg-muted">No endpoint matches “{query}”.</p>
            ) : null}
            {groups.map((g) => (
              <div key={g.tag} className="mb-2">
                <p className="px-2 py-1.5 eyebrow">{g.tag}</p>
                <ul>
                  {g.items.map((e) => {
                    const active = e.id === endpoint.id;
                    return (
                      <li key={e.id}>
                        <button
                          type="button"
                          aria-current={active ? "true" : undefined}
                          onClick={() => {
                            setPicked(e.id);
                            setOutcome(null);
                          }}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-bg-2",
                            active
                              ? "bg-accent-soft text-fg shadow-[inset_2px_0_0_var(--accent)]"
                              : "text-fg-muted",
                          )}
                        >
                          <MethodBadge method={e.method} className="w-[68px] justify-center px-1" />
                          <code className="min-w-0 truncate font-mono text-[12px]">
                            {e.path.replace(/^\/v1/, "")}
                          </code>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        {/* Main pane */}
        <div className="flex min-w-0 flex-col gap-6">
          <section aria-labelledby="endpoint-heading" className="panel p-4 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <MethodBadge method={endpoint.method} />
              <code className="font-mono text-[15px] break-all text-fg">{endpoint.path}</code>
              <Badge tone={endpoint.write ? "warn" : "ok"}>
                {endpoint.write ? "Write" : "Read"}
              </Badge>
              {endpoint.auth ? <Badge tone="muted">Bearer</Badge> : null}
            </div>
            <h2 id="endpoint-heading" className="mt-3 display display-3 text-fg">
              {endpoint.summary}
            </h2>
            {endpoint.description ? (
              <p className="mt-2 text-sm text-fg-muted">{endpoint.description}</p>
            ) : null}
            <p className="mt-1 font-mono text-[11px] tracking-[0.14em] text-fg-faint uppercase">
              {endpoint.tag} · {endpoint.id}
            </p>

            {endpoint.params.length ? (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {endpoint.params.map((p) => (
                  <ParamField
                    key={`${p.in}-${p.name}`}
                    param={p}
                    value={form.values[p.name] ?? ""}
                    onChange={(v) => setValue(p.name, v)}
                    id={`param-${endpoint.id}-${p.name}`}
                  />
                ))}
              </div>
            ) : null}

            {endpoint.body ? (
              <div className="mt-6">
                <Field
                  label={`Body · ${endpoint.body.contentType}${endpoint.body.required ? " (required)" : ""}`}
                  htmlFor={`body-${endpoint.id}`}
                  trailing={
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setBody(initialBody(endpoint, configText))}
                    >
                      Reset example
                    </Button>
                  }
                >
                  <Textarea
                    value={form.body}
                    rows={endpoint.body.contentType === "text/plain" ? 10 : 6}
                    spellCheck={false}
                    onChange={(e) => setBody(e.target.value)}
                    className="font-mono text-[13px]"
                  />
                </Field>
                {endpoint.body.contentType === "application/json" ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer font-mono text-[11px] tracking-[0.14em] text-fg-muted uppercase hover:text-fg">
                      Request schema
                    </summary>
                    <div className="mt-2 rounded-md border border-line bg-bg-0 p-3">
                      <SchemaTree schema={endpoint.body.schema} />
                    </div>
                  </details>
                ) : null}
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button
                onClick={send}
                disabled={!canSend}
                loading={sending}
                data-testid="console-send"
              >
                <Send size={14} aria-hidden="true" /> Send
              </Button>
              {missingPath.length ? (
                <span className="text-sm text-fg-muted">
                  Fill in {missingPath.map((p) => p.name).join(", ")} first.
                </span>
              ) : null}
              {!sim && !normaliseBase(target.baseUrl) ? (
                <span className="text-sm text-fg-muted">
                  Type your server&apos;s base URL first.
                </span>
              ) : null}
            </div>
          </section>

          {/* Request preview */}
          <section aria-labelledby="preview-heading" className="panel p-4 sm:p-6">
            <h2 id="preview-heading" className="label-mono text-fg-muted">
              Request preview
            </h2>
            <Tabs
              value={lang}
              onChange={(v) => setLang(v as Lang)}
              aria-label="Snippet language"
              size="sm"
              className="mt-2"
              items={[
                { value: "curl", label: "curl" },
                { value: "fetch", label: "fetch" },
                { value: "powershell", label: "PowerShell" },
              ]}
            />
            {(["curl", "fetch", "powershell"] as const).map((l) => (
              <TabPanel key={l} value={l} active={lang} className="mt-3">
                <pre
                  className="scrollbar-thin overflow-x-auto rounded-md border border-line bg-bg-0 p-3 font-mono text-[12px] leading-relaxed whitespace-pre text-fg"
                  data-testid={`snippet-${l}`}
                >
                  {snippets[l]}
                </pre>
                <CopyButton
                  text={snippets[l]}
                  label={`Copy as ${l === "powershell" ? "PowerShell" : l}`}
                  variant="secondary"
                  size="sm"
                  className="mt-2"
                />
              </TabPanel>
            ))}
          </section>

          {/* Response */}
          <section
            aria-labelledby="response-heading"
            aria-live="polite"
            className="panel p-4 sm:p-6"
          >
            <div className="flex flex-wrap items-center gap-3">
              <h2 id="response-heading" className="label-mono text-fg-muted">
                Response
              </h2>
              {outcome && outcome.status !== null ? (
                <Badge
                  tone={outcome.status < 300 ? "ok" : outcome.status < 500 ? "warn" : "danger"}
                  data-testid="response-status"
                >
                  {outcome.status} {outcome.statusText}
                </Badge>
              ) : null}
              {outcome ? (
                <span className="font-mono text-[11px] tracking-[0.14em] text-fg-faint uppercase">
                  {outcome.ms} ms{outcome.simulated ? " · simulated" : ""}
                </span>
              ) : null}
            </div>
            {!outcome ? (
              <p className="mt-3 text-sm text-fg-muted">
                Send the request to see the status, timing, headers and body here.
              </p>
            ) : outcome.error ? (
              <Callout tone="danger" className="mt-3" title="Request failed">
                {outcome.error}
              </Callout>
            ) : (
              <>
                <details className="mt-3">
                  <summary className="cursor-pointer font-mono text-[11px] tracking-[0.14em] text-fg-muted uppercase hover:text-fg">
                    Headers · {Object.keys(outcome.headers).length}
                  </summary>
                  <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-[12px]">
                    {Object.entries(outcome.headers).map(([k, v]) => (
                      <React.Fragment key={k}>
                        <dt className="text-fg-faint">{k}</dt>
                        <dd className="break-all text-fg-muted">{v}</dd>
                      </React.Fragment>
                    ))}
                  </dl>
                </details>
                <pre
                  className="mt-3 max-h-[480px] scrollbar-thin overflow-auto rounded-md border border-line bg-bg-0 p-3 font-mono text-[12px] leading-relaxed text-fg"
                  data-testid="response-body"
                >
                  {prettyJson(outcome.body) || "(empty body)"}
                </pre>
              </>
            )}
            {responseSchema ? (
              <details className="mt-4">
                <summary className="cursor-pointer font-mono text-[11px] tracking-[0.14em] text-fg-muted uppercase hover:text-fg">
                  Response schema · 200
                </summary>
                <div className="mt-2 rounded-md border border-line bg-bg-0 p-3">
                  <SchemaTree schema={responseSchema} />
                </div>
              </details>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}

function statusText(status: number): string {
  return (
    {
      200: "OK",
      400: "Bad Request",
      401: "Unauthorized",
      404: "Not Found",
      405: "Method Not Allowed",
      412: "Precondition Failed",
      503: "Service Unavailable",
    }[status] ?? ""
  );
}

function ParamField({
  param,
  value,
  onChange,
  id,
}: {
  param: Param;
  value: string;
  onChange: (v: string) => void;
  id: string;
}) {
  const label = `${param.name} · ${param.in}${param.required ? " (required)" : ""}`;
  const s = param.schema;
  if (s.enum) {
    return (
      <Field label={label} htmlFor={id} helper={param.description}>
        <Select value={value} onChange={(e) => onChange(e.target.value)}>
          {!param.required ? <option value="">—</option> : null}
          {s.enum.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </Select>
      </Field>
    );
  }
  if (s.type === "boolean") {
    return (
      <Field label={label} htmlFor={id} helper={param.description}>
        <Select value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          <option value="true">true</option>
          <option value="false">false</option>
        </Select>
      </Field>
    );
  }
  const numeric = s.type === "integer" || s.type === "number";
  return (
    <Field label={label} htmlFor={id} helper={param.description}>
      <Input
        type={numeric ? "number" : "text"}
        min={s.minimum}
        max={s.maximum}
        value={value}
        placeholder={
          numeric
            ? String(s.default ?? s.minimum ?? 0)
            : param.name === "steamId"
              ? "76561198000000000"
              : ""
        }
        onChange={(e) => onChange(e.target.value)}
        className="font-mono"
        autoComplete="off"
      />
    </Field>
  );
}
