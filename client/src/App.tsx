import { useEffect, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import Markdown from 'react-markdown';
import {
  ENVELOPE_VERSION,
  GUARDRAIL_BADGE_LABELS,
  shortCircuitVerdictSchema,
  type ChatMessage,
  type ChatRequest,
  type CivicReachUIMessage,
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
          Development shell. Safety guardrails run in front of the model, but
          there is still no eligibility logic, no retrieval, and no grounded
          benefits content behind it yet.
        </p>
      </header>

      <main className="transcript">
        {messages.length === 0 && (
          <p className="empty">
            Send a message to confirm the stream works end to end.
          </p>
        )}

        {messages.map((message) => {
          const verdict = guardrailVerdict(message);
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
