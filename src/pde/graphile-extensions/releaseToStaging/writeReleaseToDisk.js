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

  const pdeRootDirectory = process.env.PDE_ROOT_DIRECTORY
  const environmentDirectory = `${process.cwd()}${pdeRootDirectory}/${release.status.toLowerCase()}`
  const releaseDirectory = `${environmentDirectory}/${release.number}`
  const deployDirectory = `${releaseDirectory}/deploy`
  const revertDirectory = `${releaseDirectory}/revert`
  const verifyDirectory = `${releaseDirectory}/verify`

  const ensureDirResults = await Promise.all([
    ensureDir(deployDirectory),
    ensureDir(revertDirectory),
    ensureDir(verifyDirectory)
  ])
  
  clog('ensureDirResults', ensureDirResults)
  

  const writeFileResults = await Promise.all([
    writeFile(`${deployDirectory}/${release.number}-deploy.sql`, release['@ddlUp']),
    writeFile(`${revertDirectory}/${release.number}-revert.sql`, release['@ddlDown']),
    writeFile(`${verifyDirectory}/${release.number}-verify.sql`, '-- NOT IMPLEMENTED'),
  ])
  
  clog('writeFileResults', writeFileResults)

  const planContents = `%syntax-version=1.0.0
%project=${release['@project'].name}
%uri=sqitch-${release['@project'].name}/${release.number}

${release.number}-deploy.sql ${moment.utc().format()} ${sqitchUser} <${sqitchEmail}> # ${release.number} deployment
`

clog('planContents', planContents)

  const writePlanResult = await writeFile(`${releaseDirectory}/sqitch.plan`, planContents)

  clog('writePlanResult', writePlanResult)

}

module.exports = writeReleaseToDisk