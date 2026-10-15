const path = require("node:path");
module.exports = {
  plugins: {
    "@tailwindcss/postcss": {},
    [path.join(__dirname, "tooling/postcss-v3-compat.cjs")]: {},
  },
};
