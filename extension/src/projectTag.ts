/** Backend limit for llm_calls.project_tag. */
export const MAX_PROJECT_TAG_LENGTH = 100;

/**
 * The projectTag sent with each call. It comes ONLY from the devmeter.projectTag setting or the
 * workspace folder name, never from prompt text or anything else the user types, so it can't leak
 * prompt content into the backend.
 */
export function resolveProjectTag(configured: string | undefined, workspaceFolderName: string | undefined): string | undefined {
  const tag = configured?.trim() || workspaceFolderName?.trim();
  return tag ? tag.slice(0, MAX_PROJECT_TAG_LENGTH) : undefined;
}
