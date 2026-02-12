import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
    {
        ignores: [
            "node_modules",
            "dist",
            "coverage",
            ".pnpm",
            "**/dist",
            "**/.angular",
            "**/.next",
            "**/out",
            "packages/importer/**",
            "pnpm-lock.yaml",
            "**/next-env.d.ts"
        ]
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ["**/*.ts"],
        languageOptions: {
            parser: tseslint.parser
        },
        rules: {
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }]
        }
    }
];
