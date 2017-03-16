# Explanation
This is mostly an attempt to learn every JavaScript best practice at once.

I will attempt to refactor a modest project of mine, to create interesting data visualizations of Terrace BC, using things like:
* Package managers (**npm**, bower)
* Build tools (grunt, **gulp**)
* Linters (JSHint, **ESLint**)
* Testing frameworks (mocha, QUnit)
* Super-languages (CoffeeScript/**TypeScript**/Babel-ES6, SASS/LESS,**PostCSS**)
* Development frameworks (React, Angular)
* Bundlers (Browserify, **webpack**)
* Minifiers?
* FTP publishing?
* ???

To understand the point of all these tools, I think I will have to use them all on their own first.  I'm reading that grunt/gulp aren't cool anymore anyways. I guess npm can maybe do the work of bower (and since bower is only installed via npm, why bother?), that ESLint is the new JSHint, there's a hundred testing frameworks to choose from, I can't believe there isn't a declared winner in SASS vs LESS by now, React and Angular look like they're in competition to see who can make the weirdest looking methodology salad... this is HIGHLY intimidating.

What really bothers me is I don't understand why Node is popular.  I get the need for specific server-side development, but aren't most SPAs largely client-side?  Grab some JSON over AJAX and leave the rest to the UI frameworks?  I can imagine a JavaScript engine that integrates better with your editor might be invaluable (I've never really learned proper debugging technique) but Node is always marketing itself as an asynchronous high-IO server-side JavaScript blah blah blah, never a foundational tool for client developers?

In theory I get what most of the other things do, kind of.  Throw in my dabbling with git and vim, and I wonder if I'll ever get anything actually done, but still.  I can imagine this stuff being handy if you work full time at it.  I can even imagine if you're very talented, that you get quick enough to find these tools worth your time even for a smaller project.  But I'm pretty damn sure I'm a smart guy, and this feels like one hell of a mountain to climb.

# References
* [2016 JavaScript workflow](http://stackoverflow.com/questions/21198977/difference-between-grunt-npm-and-bower-package-json-vs-bower-json)
* [Stop using Grunt](https://www.keithcirkel.co.uk/why-we-should-stop-using-grunt/)
* [You Might Not Need Gulp.js](https://medium.com/swlh/you-might-not-need-gulp-js-89a0220487dd)
* [JSHint vs JSLint](http://stackoverflow.com/questions/6803305/should-i-use-jslint-or-jshint-javascript-validation)
* [JavaScript linting tools](https://www.sitepoint.com/comparison-javascript-linting-tools/)
* [SASS vs LESS](https://www.keycdn.com/blog/sass-vs-less/)
* [npm Frontend Packaging](http://blog.npmjs.org/post/101775448305/npm-and-front-end-packaging)
* [npm and ES6 Modules for Frontend Development](http://wesbos.com/javascript-modules/)
* [Webpack Getting Started](https://webpack.js.org/guides/get-started/)
* [Replace bower dependencies with minified versions](http://stackoverflow.com/questions/16761272/how-to-configure-grunt-to-replace-bower-dependencies-by-its-minified-versions)
* [Gulp CDNizer](https://www.npmjs.com/package/gulp-cdnizer)
* [Linting TypeScript with Webpack](https://templecoding.com/blog/2016/04/07/linting-typescript-with-webpack/)
* [DefinitelyTyped TypeScript type definition catalog](https://github.com/DefinitelyTyped/DefinitelyTyped)
* [Copying static assets in Webpack](http://stackoverflow.com/questions/27639005/how-to-copy-static-files-to-build-directory-with-webpack)

# Questions
* Do I put my dev stuff into a subdirectory?  Looks like /app/ and /dist/ folders are common.
* How do I actually live-test things?  Should I be configuring npm to run ESLint, start a web server, etc. right away?  That index.js entry point I lied about during npm init?
* So this means using node.js modules basically requires webpack or similar?  The node_modules directory is a giant mess after a few module installs, don't want to work in there directly.
* Why does webpack handle ES6 import syntax, but webpack.config.js only uses Node's require() syntax?
* Does webpack deal with LESS/SASS, TypeScript/CoffeeScript?  Minification?  [No!](https://webpack.github.io/docs/usage.html#using-loaders)  Only supports JavaScript, but transpilers for ES2015 (babel), CoffeeScript, TypeScript, etc. exist.  Loaders run transpilers.
* Global npm modules?  I've installed ESLint, webpack globally.  Should these be part of my package.json?  Probably?
* webpack's bundle.js file is hideous!  Would be a nightmare to debug this code.  Is this handled differently in dev?
* React starter kit?  https://github.com/kriasoft/react-starter-kit
* Test if I need webpack (or sass?) in dependencies?  Remove dependency listings, run npm install, see what works.
* What is the point of global installs (npm i -g)?  Listing depencies seems like a best practice and puts a local install in during npm i anyways.
* Should I even bother with installing TSLint or ESLint when I can just use VS Code's plugins?
* Should I make things like linters part of the dev dependencies when they're really developer preference?
* Should I just take my original project and refactor it using these new tools one at a time, understanding and superceding them as I go?
 * Bower?  No, just directly inserting CDN links
 * TypeScript?  Yes, instead of Babel ES6
 * TSLint?  Yes in VSCode, but must configure to give better recommendations
 * PostCSS?
 * Webpack?  Maybe if I start breaking .ts code up?
 * Gulp?  No, used for a while but don't need it at this point
* Webpack has no built-in support for just copying static files over.  Is that not its purpose?  Does it really want to manipulate EVERYTHING?

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

# Webpack Migration
* Branch
* Install webpack
* Get basic config file
 * Working, but including es6 array polyfill, jQuery and D3 (no bootstrap) up to 765 KB!
 * What happened to Handlebars?  Why doesn't TypeScript throw error?
  * require.extensions is not supported by webpack. Use a loader instead.
  * Module not found: Error: Can't resolve 'fs' in '...\node_modules\handlebars\lib'
 * Don't need to import jQuery for TypeScript either?  Just D3 needs it?
* babel-polyfill incorporates core-js/es6 as well as transforms generator syntax.  Look at that instead?
* Integrate source maps?  First just get this working!
  * webpack.config.js: devtool: 'inline-source-map'
  * webpack.config.js: module.rules[n].loader: 'source-map-loader'
  * tsconfig.json: sourceMap: true
* Commit
* Install plugins
* Add require() code
* Test
* Commit