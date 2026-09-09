import path from "path";

/**
 * Original medical documents (prescriptions, lab reports, discharge
 * summaries) are confidential and must never be served as static
 * assets. They live outside `public/` and are only ever read by the
 * authenticated, role-checked route in
 * `api/medical-records/[id]/document`.
 *
 * `originalFileUrl` values are still stored using the historical
 * `/uploads/medical/<file>` shape for backward compatibility with
 * existing records; this only changes where that file physically
 * lives on disk.
 */
export const MEDICAL_UPLOAD_DIRECTORY = path.join(
  process.cwd(),
  "private-uploads",
  "medical"
);

const MEDICAL_UPLOAD_URL_PREFIX = "/uploads/medical/";

/**
 * Resolve a stored `originalFileUrl` (e.g. `/uploads/medical/abc.pdf`)
 * to its file path on disk, rejecting anything that isn't a plain
 * filename inside the medical upload directory (path traversal).
 */
export function resolveMedicalUploadPath(
  originalFileUrl: string
): string | null {
  if (!originalFileUrl.startsWith(MEDICAL_UPLOAD_URL_PREFIX)) {
    return null;
  }

  const fileName = originalFileUrl.slice(
    MEDICAL_UPLOAD_URL_PREFIX.length
  );

  if (!fileName || fileName.includes("/") || fileName.includes("\\")) {
    return null;
  }

  return path.join(MEDICAL_UPLOAD_DIRECTORY, fileName);
}
