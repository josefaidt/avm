import { getPackage } from './get-package.js'

/**
 * Gets all Amplify CLI versions from the npm registry
 */
export async function getPackageVersions(): Promise<string[]> {
  const pkg = await getPackage()
  if (!pkg?.versions) throw new Error('Failed to get versions')
  return Object.keys(pkg.versions)
}
