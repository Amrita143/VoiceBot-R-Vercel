// for loacal development only

// server.js
const app = require("./app");
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Local API on http://localhost:${PORT}`));
