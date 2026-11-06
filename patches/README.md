# Shared sidebar correction

The @vxture/design-system 15.0.0 patch is built from the local design repository:
D:/MyWebSite/vxture/vxture-design, commit 0033b60dd9f2c970898c49ffe63b1f7a8eb93b8d.

It restores the console navigation geometry after the token size migration,
adds optional server-seeded group state, and fixes collapsed link names and
keyboard isolation of closed groups. The patch includes the corresponding ESM,
CJS, declarations, source maps and component stylesheet. Product code does not
replace the DS component or override its tokens. Dependencies retain their
existing locked versions. pnpm install --frozen-lockfile applies this patch.

No registry package has been published. Remove this patch when an official DS
release containing this correction is adopted.
