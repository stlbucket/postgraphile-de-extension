const clog = require('fbkt-clog')

const fs = require('fs-extra')
const promisify = require('util').promisify;
const moment = require('moment')

const ensureDir = promisify(fs.ensureDir);
const writeFile = promisify(fs.writeFile);

async function writeReleaseToDisk(release){
  clog('PDE_ROOT_DIRECTORY', process.env.PDE_ROOT_DIRECTORY)
  clog('release', release)

  const sqitchUser = process.env.PDE_SQITCH_USER
  const sqitchEmail = process.env.PDE_SQITCH_EMAIL

  clog('WRITE TO DISK THIS RELEASE', release)

  const previousRelease = release.status === 'CURRENT'
    ? (release['@project']['@historicReleases']['data'][0] || {'@nodes': null})['@nodes']
    : (release['@project']['@currentReleases']['data'][0] || {'@nodes': null})['@nodes']

    clog('currents', release['@project']['@currentReleases']['data'][0])
    clog('historics', release['@project']['@historicReleases']['data'][0])
    clog('PREVIOUS RELEASE', previousRelease)

  const projectName = release['@project'].name
  const pdeRootDirectory = process.env.PDE_ROOT_DIRECTORY
  const environmentDirectory = `${process.cwd()}${pdeRootDirectory}/${projectName}/${release.status.toLowerCase()}`
  const releaseDirectory = `${environmentDirectory}/${release.number}`
  const deployDirectory = `${releaseDirectory}/deploy`
  const revertDirectory = `${releaseDirectory}/revert`
  const verifyDirectory = `${releaseDirectory}/verify`
  const deployFile = `${deployDirectory}/${release.number}.sql`
  const revertFile = `${revertDirectory}/${release.number}.sql`
  const verifyFile = `${verifyDirectory}/${release.number}.sql`

  const ensureDirResults = await Promise.all([
    ensureDir(deployDirectory),
    ensureDir(revertDirectory),
    ensureDir(verifyDirectory),
  ])
  
  clog('ensureDirResults', ensureDirResults)

  const deployContents = `-- Deploy ${projectName}:${release.number} to pg
${previousRelease ? `-- requires: ${previousRelease.number}` : ``}

BEGIN;

${release['@ddlUp']}

COMMIT;
  `
  
  const revertContents = `-- Revert ${projectName}:${release.number} from pg

BEGIN;

${release['@ddlDown']}

COMMIT;
  `
  
  const verifyContents = `-- Verify ${projectName}:${release.number} on pg

BEGIN;

-- NOT IMPLEMENTED

COMMIT;
  `
  

  const writeFileResults = await Promise.all([
    writeFile(`${deployFile}`, deployContents),
    writeFile(`${revertFile}`, revertContents),
    writeFile(`${verifyFile}`, verifyContents),
  ])
  
  clog('writeFileResults', writeFileResults)

  const planContents = `%syntax-version=1.0.0
%project=${projectName}
%uri=sqitch-${projectName}/${release.number}

${release.number} ${previousRelease ? `[${previousRelease.number}]` : ``} ${moment.utc().format()} ${sqitchUser} <${sqitchEmail}> # ${release.number} deployment
`

clog('planContents', planContents)

const writePlanResults = await Promise.all([
  // writeFile(`${releaseDirectoryCurrent}/sqitch.plan`, planContents),
  writeFile(`${releaseDirectory}/sqitch.plan`, planContents)
])

  clog('writePlanResults', writePlanResults)

}

module.exports = writeReleaseToDisk