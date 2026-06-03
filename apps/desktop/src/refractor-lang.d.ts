declare module 'refractor/core' {
  import type { Refractor } from 'refractor';
  const refractor: Refractor;
  export default refractor;
}

declare module 'refractor/lang/*.js' {
  const grammar: (instance: import('refractor').Refractor) => void;
  export default grammar;
}
