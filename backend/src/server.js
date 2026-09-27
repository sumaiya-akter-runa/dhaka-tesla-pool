require("dotenv").config();
const app = require("./app");

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Dhaka Tesla Pool API listening on port ${PORT}`);
});
