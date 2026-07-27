import express from 'express';
import { requireEnv } from './config';
import { chatRouter } from './routes/chat';

const env = requireEnv();
const app = express();

app.use(express.json({ limit: '256kb' }));
app.use('/api', chatRouter);

app.listen(env.PORT, () => {
  console.log(`[server] API listening on http://localhost:${env.PORT}`);
});
