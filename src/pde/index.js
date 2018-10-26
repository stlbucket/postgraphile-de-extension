const clog = require('fbkt-clog')
const proxy = require('http-proxy-middleware');
const pm2 = require('pm2')
let loaded = false
let _pgClient
let _pde = null

function PostgraphileDE(builder, options) {
  // clog('options', options)
  const port = process.env.DEV_PORT

  options.app.use('/dev-graphql', proxy({
    target: `http://localhost:${port}`,
    changeOrigin: true,
    logLevel: 'debug',
    pathRewrite: {'/dev-graphql' : '/graphql'}
  }));      
  
  options.app.use('/dev', proxy({
    target: `http://localhost:${port}`,
    changeOrigin: true,
    logLevel: 'debug',
    pathRewrite: {'/dev' : '/'}
  }));      

  options.app.use('/', proxy({
    target: `http://localhost:${port}`,
    changeOrigin: true,
    logLevel: 'debug',
    pathRewrite: {'/' : '/'}
  }));      

  if (loaded === false) {
    const client = options.pgConfig.options
    // clog('client', client)
    const postgresConnection = `postgres://${client.user}:${client.password}@${client.host}:${client.port || 5432}/${client.database}`
    // clog('postgresConnection', postgresConnection)
    pm2.start(`${__dirname}/pde-api.js`, {
      name: 'pde-server',
      env: {
        POSTGRAPHILE_SCHEMAS: "pde",
        POSTGRES_CONNECTION: postgresConnection,
        DEV_PORT: port,
        // DEFAULT_ROLE: "app_anonymous",
        // JWT_SECRET: "SUPERSECRET",
        // JWT_PG_TYPE_IDENTIFIER: "auth.jwt_token",
        EXTENDED_ERRORS: "hint, detail, errcode",
        DISABLE_DEFAULT_MUTATIONS: "true",
        DYNAMIC_JSON: "true",
        ENABLE_APOLLO_ENGINE: "false",
        PORT: 5001
      }
    }, function(error, result){
  
      _pde = result;
    })
    loaded = true
  }
}

module.exports = PostgraphileDE