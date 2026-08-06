import { requireEnv } from './config';
import { buildGrounding, createApp, type Grounding } from './app';

const env = requireEnv();

let grounding: Grounding;
try {
  grounding = await buildGrounding();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    [
      '',
      'Cannot start the server — the grounding corpus failed to load:',
      `  ${message}`,
      '',
      'This server refuses to boot without a valid corpus: answers must be',
      'grounded and there are no fallback numbers by design. Fix the file(s)',
      'in server/corpus/ and the watcher will restart automatically.',
      '',
    ].join('\n'),
  );
  process.exit(1);
}

const app = createApp(grounding);

app.listen(env.PORT, () => {
  console.log(`[server] API listening on http://localhost:${env.PORT}`);
});
