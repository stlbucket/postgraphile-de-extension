# postgraphile-de

An IDE for Postgraphile

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

after this is installed, a second server is spun up using pm2.  this process statically serves the postgraphile-de UI.

the ui accesses your main server /graphql endpoint, and a proxy thru the main server on the endpoint /dev-graphql supports the pde app itself.  this is why the app argument is passed via graphileBuildOptions