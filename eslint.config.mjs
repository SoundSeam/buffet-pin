import react from "eslint-plugin-react";
import hooks from "eslint-plugin-react-hooks";
import imports from "eslint-plugin-import";
import accessibility from "eslint-plugin-jsx-a11y";
import typescript from "@typescript-eslint/eslint-plugin";
import parser from "@typescript-eslint/parser";
import globals from "globals";
import nextSource from "./tooling/eslint-next/dist/index.js";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const next = nextSource.default ?? nextSource;

export default [
  { ignores: [".next/**", ".next-dev/**", "cdk.out/**", "node_modules/**", "playwright-report/**", "test-results/**", "public/**", "next-env.d.ts", "tooling/eslint-next/dist/**"] },
  {
    files: ["**/*.{js,cjs,mjs,ts,tsx,mts,cts}"],
    languageOptions: { parser, globals: { ...globals.browser, ...globals.node }, parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { react, "react-hooks": hooks, import: imports, "jsx-a11y": accessibility, "@typescript-eslint": typescript, "@next/next": next },
    settings: {
      react: { version: "detect" },
      "import/parsers": { [require.resolve("@typescript-eslint/parser")]: [".ts", ".mts", ".cts", ".tsx", ".d.ts"] },
      "import/resolver": { [require.resolve("eslint-import-resolver-node")]: { extensions: [".js", ".jsx", ".ts", ".tsx"] }, [require.resolve("eslint-import-resolver-typescript")]: { alwaysTryTypes: true } },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...hooks.configs.recommended.rules,
      ...next.configs.recommended.rules,
      ...next.configs["core-web-vitals"].rules,
      ...typescript.configs.recommended.rules,
      "import/no-anonymous-default-export": "warn",
      "react/no-unknown-property": "off", "react/react-in-jsx-scope": "off", "react/prop-types": "off", "react/jsx-no-target-blank": "off",
      "jsx-a11y/alt-text": ["warn", { elements: ["img"], img: ["Image"] }],
      "jsx-a11y/aria-props": "warn", "jsx-a11y/aria-proptypes": "warn", "jsx-a11y/aria-unsupported-elements": "warn", "jsx-a11y/role-has-required-aria-props": "warn", "jsx-a11y/role-supports-aria-props": "warn",
      "@typescript-eslint/no-unused-vars": "warn", "@typescript-eslint/no-unused-expressions": "warn",
    },
  },
  { files: ["**/*.{ts,tsx,mts,cts}"], rules: typescript.configs["eslint-recommended"].overrides[0].rules },
  { files: ["**/*.js", "**/*.cjs"], rules: { "@typescript-eslint/no-require-imports": "off" } },
];
