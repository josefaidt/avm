interface PackageDetails {
  'dist-tags': Record<string, string>
  versions: Record<string, unknown>
}

/**
 * Get package details for Amplify CLI
 */
export async function getPackage() {
  // https://github.com/npm/registry/blob/master/docs/REGISTRY-API.md#version
  const response = await fetch('https://registry.npmjs.org/@aws-amplify/cli')
  const json = (await response.json()) as Partial<PackageDetails>
  return json
}
