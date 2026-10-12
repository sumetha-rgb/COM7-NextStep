// Intentionally do not delete .next at dev-server startup.
// A second `npm run dev` while another server is running can otherwise remove
// manifests that the active server still needs and cause ENOENT 500 errors.
console.log('[clean-next] Keeping .next intact; Next.js manages dev output.');
