const fs = require('node:fs');

// Work around EPERM from fs.promises.realpath on some Windows + Node 24
// installations. Next.js uses this call while checking TypeScript packages.
fs.promises.realpath = (...args) => new Promise((resolve, reject) => {
  fs.realpath(...args, (error, resolvedPath) => {
    if (error) reject(error);
    else resolve(resolvedPath);
  });
});

const mkdir = fs.promises.mkdir.bind(fs.promises);
fs.promises.mkdir = (directory, options) => new Promise((resolve, reject) => {
  fs.mkdir(directory, options, (error) => {
    if (error) reject(error);
    else resolve(options && typeof options === 'object' && options.recursive ? directory : undefined);
  });
});
