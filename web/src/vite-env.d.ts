/// <reference types="vite/client" />

/*
 * Vite's ambient types: `import.meta.env` and `import.meta.glob`.
 *
 * `src/online/api.ts` reaches the networking layer through `import.meta.glob`
 * so that the app still typechecks, builds and tests when `src/net/` is absent
 * or half-written. Without this reference that call is a type error, which is
 * how it arrived.
 *
 * This is the standard Vite scaffold file. It adds ambient declarations only;
 * it does not narrow `compilerOptions.types`, so every other @types package
 * the project already picks up is untouched.
 */
