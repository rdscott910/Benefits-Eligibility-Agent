import { useEffect, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ENVELOPE_VERSION,
  GUARDRAIL_BADGE_LABELS,
  REFERRAL_LINE,
  VERDICT_SUFFIX,
  VERDICT_TIER_PHRASES,
  caseFilePartDataSchema,
  checkIncomeThresholdInputSchema,
  checkIncomeThresholdOutputSchema,
  lookupIncomeLimitsInputSchema,
  resolvedLimitsSchema,
  retrievalPartDataSchema,
  shortCircuitVerdictSchema,
  tracePartDataSchema,
  updateCaseFileInputSchema,
  updateCaseFileOutputSchema,
  verdictPartDataSchema,
  type CaseFile,
  type CaseFileFactStatus,
  type ChatMessage,
  type ChatRequest,
  type Citation,
  type CivicReachUIMessage,
  type RetrievalPartData,
  type ShortCircuitVerdict,
  type TraceGuardrailSource,
  type TracePartData,
  type TraceTokenUsage,
  type VerdictPartData,
} from '@civicreach/shared';

/**
 * Central markdown renderer for model text and corpus chunks, so rendering
 * options stay identical everywhere they appear. GFM enables tables (Slice
 * 4 markdown polish — agent prompt v5 allows them in the same change) and
 * renders the corpus's own pipe tables inside citation details.
 */
function ChatMarkdown({ children }: { children: string }) {
  return <Markdown remarkPlugins={[remarkGfm]}>{children}</Markdown>;
}

function toEnvelopeMessages(messages: CivicReachUIMessage[]): ChatMessage[] {
  return messages
    .map((message) => ({
      id: message.id,
      role: message.role,
      parts: message.parts
        .filter((part) => part.type === 'text')
        .map((part) => ({ type: 'text' as const, text: part.text })),
    }))
    .filter(
      (message): message is ChatMessage =>
        message.parts.length > 0 &&
        (message.role === 'user' || message.role === 'assistant'),
    );
}

function messageText(message: CivicReachUIMessage): string {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

function guardrailVerdict(
  message: CivicReachUIMessage,
): ShortCircuitVerdict | null {
  for (const part of message.parts) {
    if (part.type === 'data-guardrail') {
      const parsed = shortCircuitVerdictSchema.safeParse(part.data.verdict);
      if (parsed.success) {
        return parsed.data;
      }
    }
  }
  return null;
}

function retrievalOutcome(
  message: CivicReachUIMessage,
): RetrievalPartData | null {
  for (const part of message.parts) {
    if (part.type === 'data-retrieval') {
      const parsed = retrievalPartDataSchema.safeParse(part.data);
      if (parsed.success) {
        return parsed.data;
      }
    }
  }
  return null;
}

function verdictOutcome(message: CivicReachUIMessage): VerdictPartData | null {
  for (const part of message.parts) {
    if (part.type === 'data-verdict') {
      const parsed = verdictPartDataSchema.safeParse(part.data);
      if (parsed.success) {
        return parsed.data;
      }
    }
  }
  return null;
}

function traceOutcome(message: CivicReachUIMessage): TracePartData | null {
  for (const part of message.parts) {
    if (part.type === 'data-trace') {
      const parsed = tracePartDataSchema.safeParse(part.data);
      if (parsed.success) {
        return parsed.data;
      }
    }
  }
  return null;
}

function caseFileFromMessage(message: CivicReachUIMessage): CaseFile | null {
  let latest: CaseFile | null = null;
  for (const part of message.parts) {
    if (part.type === 'data-casefile') {
      const parsed = caseFilePartDataSchema.safeParse(part.data);
      if (parsed.success) {
        latest = parsed.data.caseFile;
      }
    }
  }
  return latest;
}

function dollars(amount: number): string {
  return `$${amount.toLocaleString('en-US')}`;
}

// ---------------------------------------------------------------------------
// Tool status (Slice 4): rendered ONLY from the AI SDK's typed tool parts —
// a label appears exactly when a real invocation streamed, never from model
// text and never speculatively (verdict-language.md R6).
// ---------------------------------------------------------------------------

type UIMessagePart = CivicReachUIMessage['parts'][number];
type ToolPart = Extract<UIMessagePart, { type: `tool-${string}` }>;

const TOOL_PART_TYPES: ReadonlyArray<ToolPart['type']> = [
  'tool-updateCaseFile',
  'tool-lookupIncomeLimits',
  'tool-checkIncomeThreshold',
];

function isToolPart(part: UIMessagePart): part is ToolPart {
  return (TOOL_PART_TYPES as readonly string[]).includes(part.type);
}

function toolPartsOf(message: CivicReachUIMessage): ToolPart[] {
  return message.parts.filter(isToolPart);
}

const TOOL_STATUS_LABELS: Record<
  ToolPart['type'],
  { running: string; done: string; failed: string }
> = {
  'tool-updateCaseFile': {
    running: 'Updating your case file…',
    done: 'Case file updated',
    failed: 'Case file update failed',
  },
  'tool-lookupIncomeLimits': {
    running: 'Looking up NC FNS income limits…',
    done: 'Looked up NC FNS income limits',
    failed: 'Income limits lookup failed',
  },
  'tool-checkIncomeThreshold': {
    running: 'Checking NC FNS income limits…',
    done: 'Checked NC FNS income limits',
    failed: 'Income threshold check failed',
  },
};

type ToolPhase = 'running' | 'done' | 'failed';

function toolPhase(part: ToolPart): ToolPhase {
  switch (part.state) {
    case 'input-streaming':
    case 'input-available':
    case 'approval-requested':
    case 'approval-responded':
      return 'running';
    case 'output-available':
      return 'done';
    case 'output-error':
    case 'output-denied':
      return 'failed';
    default: {
      const unhandled: never = part;
      throw new Error(`Unhandled tool part state: ${String(unhandled)}`);
    }
  }
}

function ToolStatusStrip({ parts }: { parts: ToolPart[] }) {
  if (parts.length === 0) {
    return null;
  }
  return (
    <div className="tool-status" aria-label="Tool activity">
      {parts.map((part) => {
        const phase = toolPhase(part);
        return (
          <span
            key={part.toolCallId}
            className={`tool-status__chip tool-status__chip--${phase}`}
          >
            {TOOL_STATUS_LABELS[part.type][phase]}
          </span>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Clickable citation chips (Slice 4): the exact retrieved chunk and its
// score, delivered inside the `data-retrieval` part — no extra round-trip.
// ---------------------------------------------------------------------------

function CitationDetail({ citation }: { citation: Citation }) {
  return (
    <div className="citation-detail">
      <p className="citation-detail__meta">
        <strong>{citation.citationId}</strong> · {citation.title} —{' '}
        {citation.heading} · retrieval score {citation.score.toFixed(3)}
      </p>
      <div className="citation-detail__text">
        <ChatMarkdown>{citation.text}</ChatMarkdown>
      </div>
    </div>
  );
}

function RetrievalFooter({ outcome }: { outcome: RetrievalPartData }) {
  const [openCitationId, setOpenCitationId] = useState<string | null>(null);

  switch (outcome.status) {
    case 'grounded': {
      const open =
        outcome.citations.find(
          (citation) => citation.citationId === openCitationId,
        ) ?? null;
      return (
        <div className="retrieval retrieval--grounded">
          <span className="retrieval__label">Sources</span>
          {outcome.citations.map((citation) => {
            const isOpen = open?.citationId === citation.citationId;
            return (
              <button
                key={citation.citationId}
                type="button"
                className={`citation-chip${isOpen ? ' citation-chip--open' : ''}`}
                title={`${citation.title} — click to see the exact chunk`}
                aria-expanded={isOpen}
                onClick={() =>
                  setOpenCitationId(isOpen ? null : citation.citationId)
                }
              >
                {citation.citationId} · {citation.score.toFixed(2)}
              </button>
            );
          })}
          {open && <CitationDetail citation={open} />}
        </div>
      );
    }
    case 'no_match':
      return (
        <div className="retrieval retrieval--no-match">
          <span className="retrieval__label">Not in my documents</span>
          <p className="retrieval__referral">{REFERRAL_LINE}</p>
        </div>
      );
    case 'conversational':
      return null;
    default: {
      const unhandled: never = outcome;
      throw new Error(`Unhandled retrieval status: ${String(unhandled)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Glass-box trace drawer (Slice 4, trace-transparency.md): sanitize result,
// classifier verdict + latency, retrieval matches with scores, tool calls
// with real I/O, and the running conversation cost. Every figure comes from
// a typed part the pipeline actually emitted.
// ---------------------------------------------------------------------------

const TRACE_SOURCE_LABELS: Record<TraceGuardrailSource, string> = {
  crisis_fast_path: 'deterministic crisis fast-path',
  injection_fast_path: 'deterministic injection fast-path',
  classifier: 'classifier model',
  deterministic_pii: 'deterministic PII detector',
};

function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}

function formatUsd(value: number): string {
  if (value === 0) {
    return '$0.0000';
  }
  if (value < 0.0001) {
    return 'under $0.0001';
  }
  return `$${value.toFixed(4)}`;
}

function formatTokens(tokens: TraceTokenUsage): string {
  if (tokens.inputTokens === null && tokens.outputTokens === null) {
    return 'token usage unavailable';
  }
  return `${formatCount(tokens.inputTokens ?? 0)} in / ${formatCount(tokens.outputTokens ?? 0)} out tokens`;
}

/** Session running totals, summed client-side from per-turn trace parts. */
type SessionTotals = {
  turns: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

function totalsFromTraces(traces: TracePartData[]): SessionTotals {
  const totals: SessionTotals = {
    turns: traces.length,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
  };
  for (const trace of traces) {
    totals.inputTokens +=
      (trace.guardrail.tokens.inputTokens ?? 0) +
      (trace.agent?.tokens.inputTokens ?? 0) +
      (trace.retrieval?.embeddingTokens ?? 0);
    totals.outputTokens +=
      (trace.guardrail.tokens.outputTokens ?? 0) +
      (trace.agent?.tokens.outputTokens ?? 0);
    totals.costUsd += trace.estimatedCostUsd;
  }
  return totals;
}

/** Zod-parse the tool payloads before rendering them (stack-boundaries.md). */
function toolIoText(part: ToolPart): {
  input: string | null;
  output: string | null;
} {
  const render = (value: unknown): string => JSON.stringify(value, null, 2);
  const hasOutput = part.state === 'output-available';
  switch (part.type) {
    case 'tool-updateCaseFile': {
      const input = updateCaseFileInputSchema.safeParse(part.input);
      const output = hasOutput
        ? updateCaseFileOutputSchema.safeParse(part.output)
        : null;
      return {
        input: input.success ? render(input.data) : null,
        output: output?.success ? render(output.data) : null,
      };
    }
    case 'tool-lookupIncomeLimits': {
      const input = lookupIncomeLimitsInputSchema.safeParse(part.input);
      const output = hasOutput
        ? resolvedLimitsSchema.safeParse(part.output)
        : null;
      return {
        input: input.success ? render(input.data) : null,
        output: output?.success ? render(output.data) : null,
      };
    }
    case 'tool-checkIncomeThreshold': {
      const input = checkIncomeThresholdInputSchema.safeParse(part.input);
      const output = hasOutput
        ? checkIncomeThresholdOutputSchema.safeParse(part.output)
        : null;
      return {
        input: input.success ? render(input.data) : null,
        output: output?.success ? render(output.data) : null,
      };
    }
    default: {
      const unhandled: never = part;
      throw new Error(`Unhandled tool part type: ${String(unhandled)}`);
    }
  }
}

function TraceToolCalls({ parts }: { parts: ToolPart[] }) {
  if (parts.length === 0) {
    return <p className="trace__empty">No tools ran this turn.</p>;
  }
  return (
    <div className="trace__tools">
      {parts.map((part) => {
        const io = toolIoText(part);
        const phase = toolPhase(part);
        return (
          <div key={part.toolCallId} className="trace__tool">
            <p className="trace__tool-name">
              <code>{part.type.replace('tool-', '')}</code>
              <span className={`trace__tool-phase trace__tool-phase--${phase}`}>
                {phase}
              </span>
            </p>
            <div className="trace__io">
              <span className="trace__io-label">input</span>
              {io.input ? (
                <pre className="trace__json">{io.input}</pre>
              ) : (
                <p className="trace__empty">input still streaming</p>
              )}
              <span className="trace__io-label">output</span>
              {io.output ? (
                <pre className="trace__json">{io.output}</pre>
              ) : (
                <p className="trace__empty">no output</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TraceRetrievalSection({
  trace,
  retrieval,
}: {
  trace: TracePartData;
  retrieval: RetrievalPartData | null;
}) {
  if (!trace.retrieval) {
    return (
      <p className="trace__line">
        Not run — the guardrail answered this turn before retrieval, tools,
        or the agent model.
      </p>
    );
  }

  const timing = (
    <p className="trace__line">
      Query embedded and scored against the corpus in{' '}
      {formatCount(Math.round(trace.retrieval.latencyMs))} ms
      {trace.retrieval.embeddingTokens !== null &&
        ` (${formatCount(trace.retrieval.embeddingTokens)} embedding tokens)`}
      .
    </p>
  );

  if (!retrieval) {
    return (
      <>
        {timing}
        <p className="trace__line">
          No retrieval outcome arrived for this turn (the model call failed).
        </p>
      </>
    );
  }

  switch (retrieval.status) {
    case 'grounded':
      return (
        <>
          {timing}
          <ul className="trace__list">
            {retrieval.citations.map((citation) => (
              <li key={citation.citationId}>
                <code>{citation.citationId}</code> · score{' '}
                {citation.score.toFixed(3)} · {citation.heading}
              </li>
            ))}
          </ul>
        </>
      );
    case 'no_match':
      return (
        <>
          {timing}
          <p className="trace__line">
            The model declared it cannot answer this from the documents. Best
            chunk score {retrieval.bestScore?.toFixed(3) ?? 'n/a'} against
            threshold {retrieval.threshold}.
          </p>
        </>
      );
    case 'conversational':
      return (
        <>
          {timing}
          <p className="trace__line">
            No excerpt cleared the similarity threshold — conversational reply
            only, no benefit facts allowed.
          </p>
        </>
      );
    default: {
      const unhandled: never = retrieval;
      throw new Error(`Unhandled retrieval status: ${String(unhandled)}`);
    }
  }
}

function TraceDrawer({
  trace,
  retrieval,
  toolParts,
  sessionTotals,
}: {
  trace: TracePartData;
  retrieval: RetrievalPartData | null;
  toolParts: ToolPart[];
  sessionTotals: SessionTotals;
}) {
  return (
    <details className="trace">
      <summary className="trace__summary">
        Glass box — what this turn did · ≈{formatUsd(trace.estimatedCostUsd)}
      </summary>
      <div className="trace__body">
        <section className="trace__section">
          <h4 className="trace__heading">Stage 1 — sanitize</h4>
          {trace.sanitize.redactions.length === 0 ? (
            <p className="trace__line">Nothing redacted from your message.</p>
          ) : (
            <ul className="trace__list">
              {trace.sanitize.redactions.map((redaction) => (
                <li key={redaction.kind}>
                  redacted: {redaction.kind} ×{redaction.count} (kind and
                  count only — the value was discarded)
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="trace__section">
          <h4 className="trace__heading">Stage 2 — classify</h4>
          <p className="trace__line">
            Verdict <strong>{trace.guardrail.verdict}</strong> via{' '}
            {trace.guardrail.source
              ? TRACE_SOURCE_LABELS[trace.guardrail.source]
              : 'fail-closed policy (classifier unavailable)'}{' '}
            in {formatCount(Math.round(trace.guardrail.latencyMs))} ms ·{' '}
            {trace.guardrail.tokens.inputTokens === null &&
            trace.guardrail.tokens.outputTokens === null
              ? 'no model call'
              : formatTokens(trace.guardrail.tokens)}
          </p>
        </section>

        <section className="trace__section">
          <h4 className="trace__heading">Retrieval</h4>
          <TraceRetrievalSection trace={trace} retrieval={retrieval} />
        </section>

        <section className="trace__section">
          <h4 className="trace__heading">Tool calls</h4>
          <TraceToolCalls parts={toolParts} />
        </section>

        <section className="trace__section">
          <h4 className="trace__heading">Cost</h4>
          <p className="trace__line">
            This turn:{' '}
            {trace.agent
              ? `classifier ${formatTokens(trace.guardrail.tokens)} · agent ${formatTokens(trace.agent.tokens)}`
              : `classifier ${
                  trace.guardrail.tokens.inputTokens === null &&
                  trace.guardrail.tokens.outputTokens === null
                    ? 'no model call'
                    : formatTokens(trace.guardrail.tokens)
                } · agent not run`}
            {trace.retrieval?.embeddingTokens !== null &&
            trace.retrieval !== null
              ? ` · embedding ${formatCount(trace.retrieval.embeddingTokens)} tokens`
              : ''}{' '}
            · ≈{formatUsd(trace.estimatedCostUsd)}
          </p>
          <p className="trace__line trace__line--muted">
            Session so far: {formatCount(sessionTotals.inputTokens)} in /{' '}
            {formatCount(sessionTotals.outputTokens)} out tokens across{' '}
            {sessionTotals.turns}{' '}
            {sessionTotals.turns === 1 ? 'turn' : 'turns'} · ≈
            {formatUsd(sessionTotals.costUsd)} — an estimate from prices
            pinned in server config, not a bill.
          </p>
        </section>
      </div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// Verdict block and CaseFile panel.
// ---------------------------------------------------------------------------

/**
 * The structured likelihood verdict (Slice 3): tier phrase, mandatory
 * suffix, and referral all come verbatim from shared constants, keyed by the
 * deterministic tool's output — the model never authors them
 * (verdict-language.md R6).
 */
function VerdictBlock({ verdict }: { verdict: VerdictPartData }) {
  return (
    <aside className={`verdict verdict--${verdict.tier}`}>
      <span className="verdict__label">Likelihood check</span>
      <p className="verdict__context">
        Household of {verdict.limits.householdSize} · gross income{' '}
        {dollars(verdict.grossMonthlyIncome)}/month · published limits{' '}
        {dollars(verdict.limits.gross130)} (130%) and{' '}
        {dollars(verdict.limits.gross200)} (200%)
      </p>
      <p className="verdict__phrase">
        <strong>{VERDICT_TIER_PHRASES[verdict.tier]}</strong>, {VERDICT_SUFFIX}.
      </p>
      <p className="verdict__referral">{REFERRAL_LINE}</p>
    </aside>
  );
}

const FACT_STATUS_LABELS: Record<CaseFileFactStatus, string> = {
  stated: 'stated',
  needs_confirmation: 'needs confirmation',
  confirmed: 'confirmed',
};

/**
 * "What I know so far" (Slice 4 polish): every stored fact with its value
 * AND its status, honestly — including needs-confirmation — plus the
 * session-only reminder (state-memory.md: refresh clears everything).
 */
function CaseFilePanel({ caseFile }: { caseFile: CaseFile }) {
  const rows: Array<{
    label: string;
    value: string;
    status: CaseFileFactStatus;
  }> = [];
  if (caseFile.householdSize) {
    rows.push({
      label: 'Household size',
      value: `${caseFile.householdSize.value} ${
        caseFile.householdSize.value === 1 ? 'person' : 'people'
      }`,
      status: caseFile.householdSize.status,
    });
  }
  if (caseFile.grossMonthlyIncome) {
    rows.push({
      label: 'Gross monthly income',
      value: `${dollars(caseFile.grossMonthlyIncome.value)}/month`,
      status: caseFile.grossMonthlyIncome.status,
    });
  }
  if (caseFile.county) {
    rows.push({
      label: 'County',
      value: `${caseFile.county.value} County`,
      status: caseFile.county.status,
    });
  }

  return (
    <aside className="casefile" aria-label="What I know so far">
      <div className="casefile__header">
        <span className="casefile__label">What I know so far</span>
        <span className="casefile__note">
          Session only — refreshing the page clears it.
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="casefile__empty">
          Nothing stored yet. Facts you share (household size, income, county)
          appear here with their status.
        </p>
      ) : (
        <ul className="casefile__rows">
          {rows.map((row) => (
            <li key={row.label} className="casefile__row">
              <span className="casefile__fact-label">{row.label}</span>
              <span className="casefile__fact-value">{row.value}</span>
              <span
                className={`casefile__status casefile__status--${row.status}`}
              >
                {FACT_STATUS_LABELS[row.status]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

export function App() {
  // The transport closure is created once, so it reads the CaseFile through
  // a ref — React state alone would be stale inside prepareSendMessagesRequest.
  const caseFileRef = useRef<CaseFile>({});
  const [caseFile, setCaseFile] = useState<CaseFile>({});

  const { messages, sendMessage, status, error, setMessages } =
    useChat<CivicReachUIMessage>({
      transport: new DefaultChatTransport({
        api: '/api/chat',
        prepareSendMessagesRequest: ({ messages: history }) => ({
          body: {
            envelopeVersion: ENVELOPE_VERSION,
            messages: toEnvelopeMessages(history),
            caseFile: caseFileRef.current,
          } satisfies ChatRequest,
        }),
      }),
    });

  const [input, setInput] = useState('');
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const isBusy = status === 'submitted' || status === 'streaming';
  const droppedPiiMessageIds = useRef(new Set<string>());

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  // The server's data-casefile part is the state's single source of truth:
  // the latest one replaces the session copy wholesale (state-memory.md R5 —
  // only the updateCaseFile tool ever mutates facts).
  useEffect(() => {
    let latest: CaseFile | null = null;
    for (const message of messages) {
      if (message.role !== 'assistant') {
        continue;
      }
      const fromMessage = caseFileFromMessage(message);
      if (fromMessage) {
        latest = fromMessage;
      }
    }
    if (latest) {
      caseFileRef.current = latest;
      setCaseFile(latest);
    }
  }, [messages]);

  // Rejected PII messages must not stay in local history (pii-handling.md).
  useEffect(() => {
    if (status !== 'ready') {
      return;
    }

    for (let i = 0; i < messages.length; i += 1) {
      const message = messages[i];
      if (!message || message.role !== 'assistant') {
        continue;
      }
      if (guardrailVerdict(message) !== 'pii') {
        continue;
      }

      const prior = messages[i - 1];
      if (!prior || prior.role !== 'user') {
        continue;
      }
      if (droppedPiiMessageIds.current.has(prior.id)) {
        continue;
      }

      droppedPiiMessageIds.current.add(prior.id);
      setMessages(messages.filter((entry) => entry.id !== prior.id));
      return;
    }
  }, [messages, setMessages, status]);

  return (
    <div className="app">
      <header className="header">
        <h1>CivicReach</h1>
        <p>
          Estimates how likely you are to qualify for NC FNS food assistance.
          Answers are grounded in six official NC documents (click a source
          chip to see the exact excerpt), the eligibility math runs in
          deterministic tools that read the published limits, and every turn
          carries a glass-box trace of what actually happened. Facts you share
          are remembered for this session only — refreshing the page clears
          them. Only NC DSS can determine eligibility.
        </p>
      </header>

      <main className="transcript">
        {messages.length === 0 && (
          <p className="empty">
            Ask about NC FNS food assistance — for example, the income limits
            for your household size, or how likely you are to qualify.
          </p>
        )}

        {messages.map((message, index) => {
          const verdict = guardrailVerdict(message);
          const isAssistant = message.role === 'assistant';
          const retrieval = isAssistant ? retrievalOutcome(message) : null;
          const likelihood = isAssistant ? verdictOutcome(message) : null;
          const trace = isAssistant ? traceOutcome(message) : null;
          const tools = isAssistant ? toolPartsOf(message) : [];
          const sessionTotals = trace
            ? totalsFromTraces(
                messages
                  .slice(0, index + 1)
                  .filter((entry) => entry.role === 'assistant')
                  .map(traceOutcome)
                  .filter((entry): entry is TracePartData => entry !== null),
              )
            : null;
          return (
            <article
              key={message.id}
              className={`message message--${message.role}${
                verdict ? ` message--guardrail-${verdict}` : ''
              }`}
            >
              <div className="message__meta">
                <span className="message__role">
                  {message.role === 'user' ? 'You' : 'Model'}
                </span>
                {verdict && (
                  <span
                    className={`guardrail-badge guardrail-badge--${verdict}`}
                    data-verdict={verdict}
                  >
                    {GUARDRAIL_BADGE_LABELS[verdict]}
                  </span>
                )}
              </div>
              {tools.length > 0 && <ToolStatusStrip parts={tools} />}
              <div className="message__body">
                {isAssistant ? (
                  <ChatMarkdown>{messageText(message)}</ChatMarkdown>
                ) : (
                  <p>{messageText(message)}</p>
                )}
              </div>
              {likelihood && <VerdictBlock verdict={likelihood} />}
              {retrieval && <RetrievalFooter outcome={retrieval} />}
              {trace && sessionTotals && (
                <TraceDrawer
                  trace={trace}
                  retrieval={retrieval}
                  toolParts={tools}
                  sessionTotals={sessionTotals}
                />
              )}
            </article>
          );
        })}

        {status === 'submitted' && <p className="pending">Waiting for the model…</p>}

        {error && (
          <p className="error" role="alert">
            The request failed: {error.message}
          </p>
        )}

        <div ref={transcriptEndRef} />
      </main>

      <CaseFilePanel caseFile={caseFile} />

      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault();
          const text = input.trim();
          if (!text || isBusy) {
            return;
          }
          void sendMessage({ text });
          setInput('');
        }}
      >
        <input
          className="composer__input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Say something…"
          aria-label="Message"
          autoFocus
        />
        <button className="composer__send" type="submit" disabled={isBusy || !input.trim()}>
          {isBusy ? 'Streaming…' : 'Send'}
        </button>
      </form>
    </div>
  );
}
