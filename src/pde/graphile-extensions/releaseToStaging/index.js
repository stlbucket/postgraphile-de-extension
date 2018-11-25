// https://www.graphile.org/postgraphile/extending-raw/#wrapping-an-existing-resolver

const clog = require('fbkt-clog')
const writeReleaseToDisk = require('../common/writeReleaseToDisk')

module.exports = function ReleaseToStaging(builder) {
  builder.hook(
    "GraphQLObjectType:fields:field",
    (
      field,
      { pgSql: sql },
      { scope: { isRootMutation, fieldName }, addArgDataGenerator }
    ) => {
      if (!isRootMutation || fieldName !== "releaseToStaging") {
        // If it's not the root mutation, or the mutation isn't the 'createLink'
        // mutation then we don't want to modify it - so return the input object
        // unmodified.
        return field;
      }

      // It's possible that `resolve` isn't specified on a field, so in that case
      // we fall back to a default resolver.
      const defaultResolver = obj => obj[fieldName];

      // Extract the old resolver from `field`
      const { resolve: oldResolve = defaultResolver, ...rest } = field;

      return {
        // Copy over everything except 'resolve'
        ...rest,

        // Add our new resolver which wraps the old resolver
        async resolve(...resolveParams) {
          const oldResolveResult = await oldResolve(...resolveParams)
          clog('heyo', oldResolveResult.data)
          await writeReleaseToDisk(oldResolveResult.data['@release'])
          return oldResolveResult;
        },
      };
    }
  );
};

