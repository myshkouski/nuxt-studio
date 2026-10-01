// Copy of `src/runtime/utils/media.ts`, for use by the module entry (`dist/module/module.mjs`).
//
// The module entry cannot import from `src/runtime`: module-builder externalizes any import whose
// specifier contains the mkdist input dir name, rewriting it to a relative path that is not
// resolvable from `dist/module/module.mjs` and that unbuild reports as an implicit dependency.
// Keep this file in sync with the runtime original.
//
// `joinURL` from `ufo` replaces `join` from `pathe` used by the runtime original: `ufo` is declared
// as an external, whereas `pathe` is not declared as a dependency and would be bundled implicitly.
import { joinURL, withLeadingSlash } from 'ufo'
import { VIRTUAL_MEDIA_COLLECTION_NAME } from './constants'

export function generateIdFromFsPath(fsPath: string) {
  return joinURL(VIRTUAL_MEDIA_COLLECTION_NAME, fsPath)
}

export interface MediaItemKeyFields {
  id: string
  extension: string
  stem: string
  path: string
  fsPath: string
  [key: string]: unknown
}

// `key` must be a raw, unprefixed storage key — strip VIRTUAL_MEDIA_COLLECTION_NAME first if present
export function mediaItemFieldsFromKey(key: string): MediaItemKeyFields {
  const fsPath = withLeadingSlash(key.replace(/:/g, '/'))
  return {
    id: generateIdFromFsPath(fsPath),
    extension: key.split('.').pop() || '',
    stem: fsPath.split('.').slice(0, -1).join('.'),
    path: fsPath,
    fsPath,
  }
}