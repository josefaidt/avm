import { getPackage } from './get-package.js'

/**
 * Gets all Amplify CLI tags from the npm registry
 */
export async function getPackageTags(): Promise<Record<string, string>> {
  const pkg = await getPackage()
  if (!pkg?.['dist-tags']) throw new Error('Failed to get tags')
  return pkg['dist-tags']
}
