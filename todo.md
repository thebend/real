# Problems and Solutions
* Use local verbose libraries in dev, minified CDN versions in production
 * Use gulp with gulp-cdnizer to replace specified libraries
* Utilize JavaScript syntax not supported in all browsers.  TypeScript?  Babel?  Stuff like 2**3 = 8
* TypeScript says invalid references to d3 and $.  I could import references, but then would typescript compile references?  Does that break the CDN work I did?
 * Add "declare var $:any;" and similar
 * Could reference DefinitelyTyped for popular libraries
* TypeScript complains about [].find() unless export target is ES6.  Looks like I have to implement my own solution?!  Or use core-js?
* Found example that uses "import 'core-js/es6';" but I am exporting to CommonJS and that's for the server?
 * Must use webpack to bundle polyfill code instead.  See here: http://jamesknelson.com/using-es6-in-the-browser-with-babel-6-and-webpack/