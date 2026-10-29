import path from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: path.dirname(fileURLToPath(import.meta.url)) });

const eslintConfig = [
  { ignores: [".next/**", "node_modules/**"] },
  ...compat.extends("next/core-web-vitals"),
  {
    rules: {
      "no-console": ["error", { allow: ["warn", "error"] }],
      // Images are small local assets or in-memory selfie data URLs, which next/image cannot optimise.
      "@next/next/no-img-element": "off",
    },
  },
];

export default eslintConfig;
