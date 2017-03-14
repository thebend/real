# Problems and Solutions
* Use local verbose libraries in dev, minified CDN versions in production
 * Use gulp with gulp-cdnizer to replace specified libraries
* Utilize JavaScript syntax not supported in all browsers.
 * Can use TypeScript or Babel.  Let's try TypeScript!
* TypeScript says invalid references to d3 and $
 * Could add "declare var $: any;" and similar
 * Instead npm install @types/jquery @types/d3
* TypeScript complains about [].find()
 * Could export target ES6
 * Could import core-js/es6 > webpack
 * Instead including CDN polyfill script, add array.find interface to .ts, leave target ES5