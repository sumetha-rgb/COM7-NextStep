const path = require('node:path');

// Next may start a child process for development. NODE_OPTIONS makes the
// Windows realpath workaround available in that process as well.
// next-auth v4 currently pulls a dependency that still calls Node's legacy
// url.parse(). Silence only that known deprecation; keep other warnings visible.
const preload = path.join(__dirname, 'next-realpath.cjs').replaceAll('\\', '/');
process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS || ''} --require ${preload} --disable-warning=DEP0169`.trim();
require('../node_modules/next/dist/bin/next');
