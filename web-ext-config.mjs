// web-ext configuration — applies to `web-ext build` and `web-ext lint`
// when run from the repository root.
// Excludes repo-only files from packaged zips: the AMO submission linter
// flags scripts/*.sh ("Flagged file extensions"), and CI/docs files don't
// belong inside the extension package. Patterns cover both the directory
// entries and their contents so no empty folders end up in the zip either.
export default {
  ignoreFiles: [
    "scripts",
    "scripts/**",
    ".github",
    ".github/**",
    ".gitignore",
    "web-ext-config.mjs",
  ],
};
