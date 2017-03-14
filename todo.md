# Problems and Solutions
* Use local verbose libraries in dev, minified CDN versions in production
 * Use gulp with gulp-cdnizer to replace specified libraries
* Utilize JavaScript syntax not supported in all browsers.  TypeScript?  Babel?  Stuff like 2**3 = 8
 * Installed TypeScript but it complains about invalid references to d3 and jQuery.  Do I just not use bower now because I have these references?  Does that break the CDN work I did?