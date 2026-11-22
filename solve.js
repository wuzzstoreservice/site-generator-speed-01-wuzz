// makefun-site 1.0.0, the house entry, make.fun's own reference program: run(input) is make.fun's own makefun-site 1.0.0's build, called as its tree ships it
// (vendor/makefun-site/, make.fun's own code with its LICENSE and NOTICE; SOURCE.txt says what it derives from).
// An entry exports the same run from a module of its own, which must return the same answer for every input.

import * as lib from "./vendor/makefun-site/index.js";

const fn = lib["build"] ?? (lib.default != null && typeof lib.default["build"] === 'function' ? lib.default["build"].bind(lib.default) : undefined);
if (typeof fn !== 'function') throw new Error("makefun-site 1.0.0 exports no function build from index.js");

/** makefun-site 1.0.0's answer for one case's input. */
export function run(input) {
  return fn(input);
}
