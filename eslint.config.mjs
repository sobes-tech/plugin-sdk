import js from "@eslint/js";
import parser from "@typescript-eslint/parser";
import stylistic from "@stylistic/eslint-plugin";

export default [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "coverage/**",
      "examples/bundles/**",
      "plugins/bundles/**",
      "src/permissions.generated.ts",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.{js,mjs,ts,tsx}"],
    languageOptions: {
      parser,
      ecmaVersion: "latest",
      sourceType: "module",
    },
    plugins: { "@stylistic": stylistic },
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off",
      "no-redeclare": "off",
      "no-dupe-class-members": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
      curly: ["error", "all"],
      "one-var": ["error", "never"],
      "@stylistic/lines-between-class-members": ["error", "always"],
      "@stylistic/padding-line-between-statements": [
        "error",
        { blankLine: "always", prev: "*", next: ["return", "throw"] },
        { blankLine: "always", prev: ["const", "let", "var"], next: "*" },
        {
          blankLine: "any",
          prev: ["const", "let", "var"],
          next: ["const", "let", "var"],
        },
        { blankLine: "always", prev: ["block-like", "multiline-expression"], next: "*" },
        { blankLine: "always", prev: "*", next: "block-like" },
        { blankLine: "always", prev: "*", next: ["function", "class", "interface", "type"] },
        { blankLine: "always", prev: ["function", "class", "interface", "type"], next: "*" },
        { blankLine: "always", prev: "import", next: "*" },
        { blankLine: "any", prev: "import", next: "import" },
        { blankLine: "always", prev: "*", next: "export" },
      ],
    },
  },
];
