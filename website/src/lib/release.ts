const REPO = 'developer-az/pyke-dominator'
/** Releases index — /latest excludes GitHub prereleases (all our betas). */
export const RELEASES_URL = `https://github.com/${REPO}/releases`
export const REPO_URL = `https://github.com/${REPO}`

export type ReleaseInfo = {
  tag: string
  name: string
  downloadUrl: string
  assetName: string
  prerelease: boolean
}

type GhAsset = {
  name: string
  browser_download_url: string
}

type GhRelease = {
  tag_name: string
  name: string | null
  draft: boolean
  prerelease: boolean
  published_at: string | null
  assets: GhAsset[]
}

function pickExe(assets: GhAsset[]): GhAsset | undefined {
  const exes = assets.filter(
    (a) => a.name.toLowerCase().endsWith('.exe') && !a.name.toLowerCase().includes('blockmap')
  )
  return (
    exes.find((a) => /setup/i.test(a.name)) ||
    exes.find((a) => !/portable/i.test(a.name)) ||
    exes[0]
  )
}

/**
 * Newest published release that has a Windows .exe — includes prereleases
 * (v1.0.0-beta.*). GitHub's /releases/latest endpoint skips prereleases.
 */
export async function fetchLatestRelease(): Promise<ReleaseInfo | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=20`, {
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (!res.ok) return null
    const list = (await res.json()) as GhRelease[]
    if (!Array.isArray(list)) return null

    for (const data of list) {
      if (data.draft) continue
      const asset = pickExe(data.assets || [])
      if (!asset) continue
      return {
        tag: data.tag_name,
        name: data.name || data.tag_name,
        downloadUrl: asset.browser_download_url,
        assetName: asset.name,
        prerelease: !!data.prerelease,
      }
    }
    return null
  } catch {
    return null
  }
}
