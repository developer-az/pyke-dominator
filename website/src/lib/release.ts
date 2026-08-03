const REPO = 'developer-az/pyke-dominator'
export const RELEASES_URL = `https://github.com/${REPO}/releases/latest`
export const REPO_URL = `https://github.com/${REPO}`

export type ReleaseInfo = {
  tag: string
  name: string
  downloadUrl: string
  assetName: string
}

type GhAsset = {
  name: string
  browser_download_url: string
}

type GhRelease = {
  tag_name: string
  name: string | null
  assets: GhAsset[]
}

function pickExe(assets: GhAsset[]): GhAsset | undefined {
  const exes = assets.filter((a) => a.name.toLowerCase().endsWith('.exe') && !a.name.includes('blockmap'))
  return (
    exes.find((a) => /setup/i.test(a.name)) ||
    exes.find((a) => !/portable/i.test(a.name)) ||
    exes[0]
  )
}

export async function fetchLatestRelease(): Promise<ReleaseInfo | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (!res.ok) return null
    const data = (await res.json()) as GhRelease
    const asset = pickExe(data.assets || [])
    if (!asset) return null
    return {
      tag: data.tag_name,
      name: data.name || data.tag_name,
      downloadUrl: asset.browser_download_url,
      assetName: asset.name,
    }
  } catch {
    return null
  }
}
