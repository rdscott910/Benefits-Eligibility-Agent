import { useEffect, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import Markdown from 'react-markdown';
import {
  ENVELOPE_VERSION,
  GUARDRAIL_BADGE_LABELS,
  REFERRAL_LINE,
  VERDICT_SUFFIX,
  VERDICT_TIER_PHRASES,
  caseFilePartDataSchema,
  retrievalPartDataSchema,
  shortCircuitVerdictSchema,
  verdictPartDataSchema,
  type CaseFile,
  type ChatMessage,
  type ChatRequest,
  type CivicReachUIMessage,
  type RetrievalPartData,
  type ShortCircuitVerdict,
  type VerdictPartData,
} from '@civicreach/shared';

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

/**
 * Slice 2 renders retrieval honestly but minimally: source chips with the
 * citation id and raw cosine score, and the official referral (from shared
 * constants — the model never authors it) on no-match answers. Clickable
 * chunk/score inspection is Slice 4.
 */
function RetrievalFooter({ outcome }: { outcome: RetrievalPartData }) {
  switch (outcome.status) {
    case 'grounded':
      return (
        <div className="retrieval retrieval--grounded">
          <span className="retrieval__label">Sources</span>
          {outcome.citations.map((citation) => (
            <span
              key={citation.citationId}
              className="citation-chip"
              title={citation.title}
            >
              {citation.citationId} · {citation.score.toFixed(2)}
            </span>
          ))}
        </div>
      );
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

/** Minimal, honest session-state readout ("What I know so far" polish is Slice 4). */
function CaseFileStrip({ caseFile }: { caseFile: CaseFile }) {
  const entries: string[] = [];
  if (caseFile.householdSize) {
    entries.push(
      `household of ${caseFile.householdSize.value}${
        caseFile.householdSize.status === 'needs_confirmation'
          ? ' (needs confirmation)'
          : ''
      }`,
    );
  }
  if (caseFile.grossMonthlyIncome) {
    entries.push(
      `gross income ${dollars(caseFile.grossMonthlyIncome.value)}/month${
        caseFile.grossMonthlyIncome.status === 'needs_confirmation'
          ? ' (needs confirmation)'
          : ''
      }`,
    );
  }
  if (caseFile.county) {
    entries.push(`${caseFile.county.value} County`);
  }

  if (entries.length === 0) {
    return null;
  }
  return (
    <div className="casefile" aria-label="What I know so far">
      <span className="casefile__label">What I know so far</span>
      <span className="casefile__facts">{entries.join(' · ')}</span>
      <span className="casefile__note">Session only — refresh clears it.</span>
    </div>
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
          Answers are grounded in six official NC documents (with sources
          shown), the eligibility math runs in deterministic tools that read
          the published limits, and facts you share are remembered for this
          session only — refreshing the page clears them. Only NC DSS can
          determine eligibility.
        </p>
      </header>

      <main className="transcript">
        {messages.length === 0 && (
          <p className="empty">
            Ask about NC FNS food assistance — for example, the income limits
            for your household size, or how likely you are to qualify.
          </p>
        )}

        {messages.map((message) => {
          const verdict = guardrailVerdict(message);
          const retrieval =
            message.role === 'assistant' ? retrievalOutcome(message) : null;
          const likelihood =
            message.role === 'assistant' ? verdictOutcome(message) : null;
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
              <div className="message__body">
                {message.role === 'assistant' ? (
                  <Markdown>{messageText(message)}</Markdown>
                ) : (
                  <p>{messageText(message)}</p>
                )}
              </div>
              {likelihood && <VerdictBlock verdict={likelihood} />}
              {retrieval && <RetrievalFooter outcome={retrieval} />}
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

      <CaseFileStrip caseFile={caseFile} />

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
