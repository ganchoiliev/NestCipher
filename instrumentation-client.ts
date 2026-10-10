// Routes that cost money or write data get BotID protection. The client
// attaches classification headers to these requests; the matching route
// handlers call checkBotId() server-side. See docs/DECISIONS.md.
// Workbench entry and exit use fresh document navigation. Do not even
// import the SDK on that initial document: importing can have side effects.
const isWorkbench = window.location.pathname.replace(/\/+$/, "") ===
  "/tools/research-workbench";

if (!isWorkbench) {
  import("botid/client/core")
    .then(({ initBotId }) => {
      initBotId({
        protect: [
          { path: "/api/analyze-email", method: "POST" },
          { path: "/api/subscribe", method: "POST" },
        ],
      });
    })
    .catch(() => {
      // The protected API handlers still enforce their server-side checks.
      console.error("Unable to initialize bot protection.");
    });
}
