#!/usr/bin/env bun
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { Binary } from '@aws-amplify/cli/binary'
import { program, Command } from '@commander-js/extra-typings'
import kleur from 'kleur'
import { maxSatisfying, valid } from 'semver'
import { z } from 'zod'
import * as pkg from './package.json' assert { type: 'json' }
import { confirm } from './support/prompt.js'
import { getPackageVersions } from './support/get-package-versions.js'
import { getPackageTags } from './support/get-package-tags.js'

/**
 * Where AVM stores its data
 */
const AVM_DIR = path.join(os.homedir(), '.avm')
/**
 * Where AWS Amplify CLI stores its data
 */
const AMPLIFY_DIR = path.join(os.homedir(), '.amplify')
/**
 * Where AWS Amplify CLI stores its binary
 */
const AMPLIFY_BIN_DIR = path.join(AMPLIFY_DIR, 'bin')
/**
 * Amplify CLI binary path
 */
const AMPLIFY_BIN_PATH = path.join(AMPLIFY_BIN_DIR, 'amplify')

const VERSION_INVALID_MESSAGE = 'version must be a valid semver string'
const VERSION_NOT_FOUND_MESSAGE = 'version not found'
const version_schema = z.string({
  description: 'version to install',
  coerce: true,
  errorMap: (issue, ctx) => {
    let message = issue.message ?? ctx.defaultError
    switch (issue.code) {
      case z.ZodIssueCode.invalid_string:
        message = VERSION_INVALID_MESSAGE
      default: {
        break
      }
    }
    return { message }
  },
})

const npm_version_schema = version_schema
  // transform the value by looking up the max satisfying version
  .transform(async (val, ctx) => {
    const versions = await getPackageVersions()
    const tags = await getPackageTags()

    // the value is either a valid semver string or a tag
    // if it's a valid semver string, we need to check if it's a valid version
    if (valid(val)) {
      // "11.0.0" is valid
      return val
    }

    // if it's a tag, we need to look up the version
    const tagged = tags[val]
    if (tagged) {
      // "beta" is not valid, but "11.0.0-beta.8" is
      return tagged
    }

    // if it's a shorthand version (i.e. "11"), we need to look up the max satisfying version
    const satisfied = maxSatisfying(versions, val)
    if (satisfied) {
      return satisfied
    }

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: VERSION_NOT_FOUND_MESSAGE,
    })

    return z.NEVER
  })
  // old behavior, will just validate the input
  // .transform((val, ctx) => {
  //   const coerced = coerce(val)
  //   if (coerced === null) {
  //     ctx.addIssue({
  //       code: z.ZodIssueCode.custom,
  //       message: VERSION_INVALID_MESSAGE,
  //     })
  //     return z.NEVER
  //   }
  //   return coerced.version
  // })
  .refine((v) => valid(v), {
    message: VERSION_INVALID_MESSAGE,
  })

function handleSchemaValidation(schema: z.Schema, value: unknown) {
  try {
    return schema.parse(value)
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(kleur.red(error.issues[0].message))
    }
    process.exit(1)
  }
}

function handleVersionValidation(version: string) {
  return handleSchemaValidation(version_schema, version)
}

class InstallError extends Error {}

async function installVersion(version: string) {
  const binary = new Binary(version)
  try {
    await binary.install()
  } catch (cause) {
    throw new InstallError(`Failed to install @aws-amplify/cli@${version}`, {
      cause,
    })
  }
}

const install = new Command('install')
  .description('install a specific version of @aws-amplify/cli')
  .argument('<version>', 'version to install', handleVersionValidation)
  .option('-d, --debug', 'enable debug mode', false)
  .action(async (version, options) => {
    // parse version
    let npm_version
    try {
      npm_version = await npm_version_schema.parseAsync(version)
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error(kleur.red(error.issues[0].message))
      } else {
        console.error(kleur.red('Failed to parse version'))
      }
      process.exit(1)
    }
    try {
      await installVersion(npm_version)
    } catch (error) {
      if (error instanceof InstallError) {
        console.error(kleur.red(error.message))
        if (options.debug) {
          console.error(error.cause)
        }
        process.exit(1)
      }
    }
  })

const use = new Command('use')
  .description('use a specific version of @aws-amplify/cli')
  .argument('<version>', 'version to use', handleVersionValidation)
  .option('-d, --debug', 'enable debug mode', false)
  .action(async (version, options) => {
    // parse version
    let npm_version
    try {
      npm_version = await npm_version_schema.parseAsync(version)
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error(kleur.red(error.issues[0].message))
      } else {
        console.error(kleur.red('Failed to parse version'))
      }
      process.exit(1)
    }

    const binary = new Binary(npm_version)
    // if binary is not installed, prompt for install
    if (!binary.isInstalled) {
      const message = `@aws-amplify/cli@${npm_version} is not installed. Install now?`
      const shouldInstall = await confirm(message)
      if (shouldInstall) {
        try {
          await installVersion(npm_version)
        } catch (error) {
          if (error instanceof InstallError) {
            console.error(kleur.red(error.message))
            if (options.debug) {
              console.error(error.cause)
            }
            process.exit(1)
          }
        }
      } else {
        process.exit(0)
      }
    }
    // create symlink
    try {
      await fs.unlink(path.join(binary.amplifyInstallDirectory, 'amplify'))
      await fs.symlink(binary.path, AMPLIFY_BIN_PATH)
    } catch (error) {
      console.error(kleur.red('Failed to create symlink'))
      if (options.debug) {
        console.error(error)
      }
      process.exit(1)
    }
    console.log(kleur.cyan(`Now using @aws-amplify/cli@${npm_version}`))
  })

const bin = new Command('bin')
  .description('get Amplify CLI binary path')
  .action(() => console.log(AMPLIFY_BIN_DIR))

async function getInstalledVersions() {
  const versions = await fs.readdir(AVM_DIR)
  return versions.map((version) => path.basename(version))
}

const list = new Command('list')
  .description('list installed versions')
  .action(async () => {
    const versions = await getInstalledVersions()
    if (versions.length === 0) {
      console.log(kleur.yellow('No versions installed'))
    } else {
      console.log(kleur.cyan('Installed versions:'))
      for (const version of versions) {
        console.log(`\t${version}`)
      }
    }
  })

program.name('avm').description('Manage @aws-amplify/cli versions')
program.version(pkg.version)
program.addCommand(bin)
program.addCommand(install)
program.addCommand(use)
program.addCommand(list)

export function run(argv = process.argv) {
  program.parse(argv)
  return program
}

run()
