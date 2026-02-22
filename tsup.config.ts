import { defineConfig } from "tsup";

export default defineConfig({
    entry: {
        cli: "src/cli/index.ts",
    },
    format: ["esm"],
    dts: false,
    splitting: false,
    sourcemap: true,
    clean: true,
    target: "node20",
    banner: () => {
        return {
            js: `// httpulse — Monitor de Saúde HTTP & Sonda de API
// Feito por nesquiksuquinho — https://github.com/nesquiksuquinho/httpulse
`,
        };
    },
});
