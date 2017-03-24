Array.prototype.find||Object.defineProperty(Array.prototype,"find",{value:function(a){if(null==this)throw new TypeError('"this" is null or not defined');var b=Object(this),c=b.length>>>0;if("function"!=typeof a)throw new TypeError("predicate must be a function");for(var d=arguments[1],e=0;e<c;){var f=b[e];if(a.call(d,f,e,b))return f;e++}}});
Array.prototype.includes||Object.defineProperty(Array.prototype,"includes",{value:function(a,b){function g(a,b){return a===b||"number"==typeof a&&"number"==typeof b&&isNaN(a)&&isNaN(b)}if(null==this)throw new TypeError('"this" is null or not defined');var c=Object(this),d=c.length>>>0;if(0===d)return!1;for(var e=0|b,f=Math.max(e>=0?e:d-Math.abs(e),0);f<d;){if(g(c[f],a))return!0;f++}return!1}});

interface Array<T> {
    find(predicate: (needle: T) => boolean): T;
    includes(needle: T): boolean
}
