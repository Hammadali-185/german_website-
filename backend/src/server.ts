import { createServer } from "node:http";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { attachRealtime } from "./realtime/server.js";
import { publishPending } from "./realtime/publish.js";

const app = createApp();
const server = createServer(app);
attachRealtime(server);
setInterval(() => void publishPending(), 1000);
server.listen(env.PORT, () => {
  console.log(`Pizza Blitz API listening on ${env.PORT}`);
});
