import { randomUUID } from "node:crypto";

export const GROUP_IMAGES_BUCKET = "group-images";
export const MAX_GROUP_IMAGE_SIZE = 5 * 1024 * 1024;

const extensions = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export function imageExtension(file: File) {
  if (file.size === 0 || file.size > MAX_GROUP_IMAGE_SIZE) {
    throw Response.json(
      { error: "Choose an image smaller than 5 MB." },
      { status: 400 },
    );
  }

  const extension = extensions[file.type as keyof typeof extensions];
  if (!extension) {
    throw Response.json(
      { error: "Choose a JPEG, PNG, or WebP image." },
      { status: 400 },
    );
  }

  return extension;
}

export function newImagePath(prefix: string, file: File) {
  return `${prefix}/${randomUUID()}.${imageExtension(file)}`;
}

export function imageResponse(file: Blob) {
  return new Response(file, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": file.type || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
