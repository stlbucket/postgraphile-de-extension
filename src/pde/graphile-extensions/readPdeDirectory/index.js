const clog = require('fbkt-clog')
const Promise = require('bluebird')
const { makeExtendSchemaPlugin, gql } = require("graphile-utils");
const readdirp = require('readdirp');
const path = require('path')
const es = require('event-stream')

async function derpaReadDirp(){
  const d = Promise.defer()
  let allEntries = []

  const stream = readdirp({ 
    root: path.join(`${process.cwd()}/${process.env.PDE_ROOT_DIRECTORY}`), 
    directoryFilter: [ '!.git', '!*modules' ] }
  );

  stream
    .on('warn', function (err) {
      console.error('non-fatal error', err);
      // optionally call stream.destroy() here in order to abort and cause 'close' to be emitted
    })
    .on('error', function (err) { 
      clog.error('derpaReadDirp ERROR', err)
      d.reject(err)
     })
    .on('data', function(entry) {
      allEntries = allEntries.concat([{
        name: entry.name,
        path: entry.path
      }])
    })
    .on('end', function(data) {
      d.resolve(allEntries)
    })

  return d.promise
}

const ReadPdeDirectoryPlugin = makeExtendSchemaPlugin(build => {
  const { pgSql: sql } = build;
  return {
    typeDefs: gql`
    input ReadPdeDirectoryInput {
      clientMutationId: String
    }

    type ReadPdeDirectoryPayload {
      pdeDirectoryContents: JSON!
    }

    extend type Mutation {
      ReadPdeDirectory(input: ReadPdeDirectoryInput!): ReadPdeDirectoryPayload
    }
  `,
  resolvers: {
      Mutation: {
        ReadPdeDirectory: async (
          _mutation,
          args,
          context,
          resolveInfo,
          { selectGraphQLResultFromTable }
        ) => {
          const allEntries = await derpaReadDirp()

          return {
            pdeDirectoryContents: allEntries
          }
        },
      },
    },
  };
});

module.exports = ReadPdeDirectoryPlugin


