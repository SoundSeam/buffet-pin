# Next lint source adaptation

Source: @next/eslint-plugin-next 15.5.27 npm tarball, MIT, from vercel/next.js tag v15.5.27. All rule implementations and severities are retained. The only semantic change is dist/utils/get-root-dirs.js: fast-glob is replaced by tinyglobby's synchronous directory discovery with expandDirectories=false. A trailing space in a utility comment is also cleaned. The source is vendored rather than installed with its unpatched braces dependency. This is Buffet Pin maintained code, not an upstream-supported package release.

Compatibility: tests/unit/security-lint.test.ts checks every previously enabled resolved rule and root-directory discovery, plus positive/negative rules. Preserve license/provenance. Update rules together with the matching Next runtime; review the source diff and rerun tests. Remove this adaptation when a supported upstream release no longer reaches GHSA-vfj7-8cjw-p6xm. No advisory or rule is suppressed.
