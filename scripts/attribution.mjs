// SPDX-License-Identifier: GPL-3.0
// Attribution header prepended to the compiled bundle.
//
// Revenge evaluates a legacy plugin as `vendetta=>{return ${plugin.js}}` (revenge-bundle
// src/core/vendetta/plugins.ts). JavaScript forbids a line terminator between `return` and its
// expression, so ANY newline between the start of the bundle and the plugin's opening `(`
// (including the one that ends a header comment) makes the function `return;` and the whole plugin
// body unreachable. Keep the header on a single line and end it with a space, never a newline.
export const ATTRIBUTION_NOTICE = "/* ClientThemes by sapphire/aeongdesu; credits m4fn3/FreeNitroTheme. GPL-3.0; see LICENSE. */ ";

const LINE_TERMINATOR = /[\n\r\u2028\u2029]/;

export function withAttribution(code) {
    if (LINE_TERMINATOR.test(ATTRIBUTION_NOTICE)) {
        throw new Error("Attribution notice must not contain a line terminator (breaks Revenge's `return` wrapper)");
    }
    // Also drop any leading whitespace/newline in the generated code so nothing separates header and expression.
    return ATTRIBUTION_NOTICE + code.trimStart();
}
