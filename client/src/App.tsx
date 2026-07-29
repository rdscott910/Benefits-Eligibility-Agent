import { useEffect, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import Markdown from 'react-markdown';
import {
  ENVELOPE_VERSION,
  GUARDRAIL_BADGE_LABELS,
  REFERRAL_LINE,
  retrievalPartDataSchema,
  shortCircuitVerdictSchema,
  type ChatMessage,
  type ChatRequest,
  type CivicReachUIMessage,
  type RetrievalPartData,
  type ShortCircuitVerdict,
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

export function App() {
  const { messages, sendMessage, status, error, setMessages } =
    useChat<CivicReachUIMessage>({
      transport: new DefaultChatTransport({
        api: '/api/chat',
        prepareSendMessagesRequest: ({ messages: history }) => ({
          body: {
            envelopeVersion: ENVELOPE_VERSION,
            messages: toEnvelopeMessages(history),
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
          shown); questions outside them are declined honestly. No eligibility
          math or memory of prior turns yet — and only NC DSS can determine
          eligibility.
        </p>
      </header>

      <main className="transcript">
        {messages.length === 0 && (
          <p className="empty">
            Ask about NC FNS food assistance — for example, the income limits
            for your household size, or how to apply.
          </p>
        )}

        {messages.map((message) => {
          const verdict = guardrailVerdict(message);
          const retrieval =
            message.role === 'assistant' ? retrievalOutcome(message) : null;
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
