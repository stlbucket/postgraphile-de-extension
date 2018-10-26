import Vue from "vue";
import VueApollo from "vue-apollo";
import {
  createApolloClient,
  restartWebsockets
} from "vue-cli-plugin-apollo/graphql-client";

// Install the vue plugin
Vue.use(VueApollo);

// Name of the localStorage item
const AUTH_TOKEN = "apollo-token";
const AUTH_TOKEN_DEV = "apollo-token-dev";

// Http endpoint
const httpEndpoint = `${window.location.origin}/dev-graphql`
  // process.env.VUE_APP_GRAPHQL_HTTP ? `${process.env.VUE_APP_GRAPHQL_HTTP}/dev-graphql` : "http://localhost:8080/dev-graphql";
const httpDevEndpoint = `${window.location.origin}/graphql`
  // process.env.VUE_APP_GRAPHQL_HTTP ? `${process.env.VUE_APP_GRAPHQL_HTTP}/graphql` : "http://localhost:8080/graphql";
// Files URL root
export const filesRoot =
  process.env.VUE_APP_FILES_ROOT ||
  httpEndpoint.substr(0, httpEndpoint.indexOf("/graphql"));

Object.defineProperty(Vue.prototype, "$filesRoot", {
  get: () => filesRoot
});

// Config
const defaultOptions = {
  // You can use `https` for secure connection (recommended in production)
  httpEndpoint,
  // You can use `wss` for secure connection (recommended in production)
  // Use `null` to disable subscriptions
  wsEndpoint: null, //process.env.VUE_APP_GRAPHQL_WS || "ws://localhost:8080/graphql",
  // LocalStorage token
  tokenName: AUTH_TOKEN,
  // Enable Automatic Query persisting with Apollo Engine
  persisting: false,
  // Use websockets for everything (no HTTP)
  // You need to pass a `wsEndpoint` for this to work
  websocketsOnly: false,
  // Is being rendered on the server?
  ssr: false

  // Override default http link
  // link: myLink

  // Override default cache
  // cache: myCache

  // Override the way the Authorization header is set
  // getAuth: (tokenName) => ...

  // Additional ApolloClient options
  // apollo: { ... }

  // Client local data (see apollo-link-state)
  // clientState: { resolvers: { ... }, defaults: { ... } }
};

const defaultDevOptions = {
  // You can use `https` for secure connection (recommended in production)
  httpEndpoint: httpDevEndpoint,
  // You can use `wss` for secure connection (recommended in production)
  // Use `null` to disable subscriptions
  wsEndpoint: null, //process.env.VUE_APP_GRAPHQL_WS || "ws://localhost:8080/graphql",
  // LocalStorage token
  tokenName: AUTH_TOKEN_DEV,
  // Enable Automatic Query persisting with Apollo Engine
  persisting: false,
  // Use websockets for everything (no HTTP)
  // You need to pass a `wsEndpoint` for this to work
  websocketsOnly: false,
  // Is being rendered on the server?
  ssr: false

  // Override default http link
  // link: myLink

  // Override default cache
  // cache: myCache

  // Override the way the Authorization header is set
  // getAuth: (tokenName) => ...

  // Additional ApolloClient options
  // apollo: { ... }

  // Client local data (see apollo-link-state)
  // clientState: { resolvers: { ... }, defaults: { ... } }
};

// Call this in the Vue app file
export function createProvider(options = {}) {
  // Create apollo client
  const { apolloClient, wsClient } = createApolloClient({
    ...defaultOptions,
    ...options
  });
  apolloClient.wsClient = wsClient;
  console.log('apolloClient for db under development', apolloClient)

  const apolloDevClient = createApolloClient({
    ...defaultDevOptions,
    ...options
  }).apolloClient;
  console.log('apolloClient for postgraphile-de - uses proxy thru dev-server', apolloDevClient)

  // Create vue apollo provider
  const apolloProvider = new VueApollo({
    clients: {
      a: apolloClient,
      b: apolloDevClient
    },
    defaultClient: apolloClient,
    defaultOptions: {
      $query: {
        // fetchPolicy: 'cache-and-network',
      }
    },
    errorHandler(error) {
      // eslint-disable-next-line no-console
      console.log(
        "%cError",
        "background: red; color: white; padding: 2px 4px; border-radius: 3px; font-weight: bold;",
        error.message
      );
    }
  });

  return apolloProvider;
}

// Manually call this when user log in
export async function onLogin(apolloClient, token) {
  localStorage.setItem(AUTH_TOKEN, token);
  if (apolloClient.wsClient) restartWebsockets(apolloClient.wsClient);
  try {
    await apolloClient.resetStore();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log("%cError on cache reset (login)", "color: orange;", e.message);
  }
}

// Manually call this when user log out
export async function onLogout(apolloClient) {
  localStorage.removeItem(AUTH_TOKEN);
  if (apolloClient.wsClient) restartWebsockets(apolloClient.wsClient);
  try {
    await apolloClient.resetStore();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log("%cError on cache reset (logout)", "color: orange;", e.message);
  }
}
