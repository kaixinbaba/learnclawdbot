export const generateR2Key = ({
  fileName,
  path = "",
  prefix,
}: {
  fileName: string;
  path?: string;
  prefix?: string;
}): string => {
  const originalFileExtension = fileName.split(".").pop();
  const randomPart = `${Date.now()}-${Math.random()
    .toString(36)
    .substring(2, 8)}${originalFileExtension ? `.${originalFileExtension}` : ""}`;

  const finalFileName = prefix
    ? `${prefix}-${randomPart}`
    : randomPart;
  const cleanedPath = path.replace(/^\/+|\/+$/g, "");
  return cleanedPath ? `${cleanedPath}/${finalFileName}` : finalFileName;
};
