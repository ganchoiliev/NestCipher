import { initBotId } from "botid/client/core";

// Routes that cost money or write data get BotID protection. The client
// attaches classification headers to these requests; the matching route
// handlers call checkBotId() server-side. See docs/DECISIONS.md.
initBotId({
  protect: [
    { path: "/api/analyze-email", method: "POST" },
    { path: "/api/subscribe", method: "POST" },
  ],
});
