import { createApp } from "./app.js";
import { env } from "./config/env.js";

const app = createApp();
app.listen(env.PORT, () => {
  console.log(`Pizza Blitz API listening on ${env.PORT}`);
});
