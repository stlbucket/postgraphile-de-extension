# postgraphile-de

An IDE for Postgraphile

this tool is still under construction, but you can try it out today!

## install
```
yarn add postgraphile-de-extension
```

## add to your extensions
```
const plugins = [
  require('postgraphile-plugin-connection-filter'),
  require('../src/postgraphile-de')
]
```

## pass the app in your graphile build options
```
app.use(postgraphile(
  connection
  ,schemas
  ,{
    dynamicJson: dynamicJson
    // ,pgDefaultRole: pgDefaultRole
    // ,jwtSecret: jwtSecret
    // ,jwtPgTypeIdentifier: jwtPgTypeIdentifier
    ,showErrorStack: true
    ,extendedErrors: ['severity', 'code', 'detail', 'hint', 'positon', 'internalPosition', 'internalQuery', 'where', 'schema', 'table', 'column', 'dataType', 'constraint', 'file', 'line', 'routine']
    ,disableDefaultMutations: disableDefaultMutations
    ,appendPlugins: plugins
    ,watchPg: watchPg
    ,graphileBuildOptions: {
      app: app                <<<--------- like this
    }
  }
));
```

## what this does
similar to postgraphile_watch, a schema will be installed to your database called 'pde'.

a second postgraphile server is then spun up using pm2.  this process statically serves the postgraphile-de UI.

the ui accesses your main server /graphql endpoint, and a proxy thru the main server on the endpoint /dev-graphql supports the pde app itself.  this is why the app argument is passed via graphileBuildOptions

to use the tool go to http://localhost:5000/dev  - you will need to adjust the url accordingly.  the UI is at the /dev location


## how this is accomplished
by severely abusing the plugin system to hi-jack the client and allow direct sql execution on the db

there is no doubt that much of this code must be refactored into a better state

also, a mechanism to make sure this doesn't run in any other environment than dev will be needed

you may need pm2 installed globally. then again you may not.