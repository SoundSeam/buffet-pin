// Tailwind 4 font-size utilities inherit --tw-leading from lower breakpoints.
// v3 reset line-height at each responsive font size. Preserve that cascade while
// leaving explicit leading utilities and arbitrary line heights authoritative.
// Sibling spacing/dividers also keep v3 first/hidden-child and physical-edge semantics.
module.exports = () => ({
  postcssPlugin: "buffet-v3-cascade",
  OnceExit(root) {
    root.walkRules(rule => {
      if (!/(space-[xy]-|divide-)/.test(rule.selector) || !rule.selector.includes(":not(:last-child)")) return;
      rule.selector = rule.selector.replaceAll(":not(:last-child)", ":not([hidden]) ~ :not([hidden])");
      if (rule.selector.startsWith(":where(") && rule.selector.endsWith(")")) rule.selector = rule.selector.slice(7, -1);
      const properties = {
        "margin-block-start": "margin-bottom", "margin-block-end": "margin-top",
        "margin-inline-start": "margin-right", "margin-inline-end": "margin-left",
        "border-block-start-width": "border-bottom-width", "border-block-end-width": "border-top-width",
        "border-inline-start-width": "border-right-width", "border-inline-end-width": "border-left-width",
      };
      rule.walkDecls(declaration => { if (properties[declaration.prop]) declaration.prop = properties[declaration.prop]; });
    });
    root.walkDecls("line-height", declaration => {
      const prefix = /^var\(--tw-leading,\s*/.exec(declaration.value);
      if (!prefix || !declaration.value.endsWith(")")) return;
      const rule = declaration.parent;
      if (rule.type !== "rule" || !rule.nodes.some(node => node.type === "decl" && node.prop === "font-size")) return;
      declaration.value = declaration.value.slice(prefix[0].length, -1).trim();
    });
  },
});
module.exports.postcss = true;
