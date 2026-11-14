# Released view mode control

BS-MOSS pins @vxture/design-system 15.6.1 from GitHub Packages. The umbrella
resolves @vxture/design-ui 12.5.1 and @vxture/design-tokens 4.1.0. The shared
ViewModeSwitch is now official DS functionality, consumed directly by five
pages; no view-mode dependency patch or application control wrapper is needed.

Release PR: https://github.com/vxture/vxture-design/pull/142
Publish run: https://github.com/vxture/vxture-design/actions/runs/43581008582

# Remaining sidebar compatibility patch

The @vxture/design-system 15.6.1 patch preserves the pre-existing BS-MOSS
server-seeded closed-group preference and change callback, plus keyboard
isolation of hidden groups. These optional props are not in the official
15.6.1 sidebar API. New official sidebar geometry is retained; this patch does
not modify ViewModeSwitch, tokens or other controls.

ESM, CJS and both type declarations are patched. pnpm 10.30.3 applies the patch
recorded in package.json and pnpm-lock.yaml. Remove it only after an official
release includes the corresponding sidebar preference API.
