import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { processImage, UploadError } from "@/lib/images/process";

async function photoWithGps(): Promise<File> {
  const jpeg = await sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 40, g: 120, b: 160 } } })
    .withExif({
      IFD0: { Make: "ShoreCam", Model: "Test" },
      IFD3: { GPSLatitudeRef: "N", GPSLatitude: "43/1 39/1 40/1", GPSLongitudeRef: "W", GPSLongitude: "79/1 18/1 25/1" },
    })
    .jpeg()
    .toBuffer();
  return new File([new Uint8Array(jpeg)], "beach.jpg", { type: "image/jpeg" });
}

describe("processImage", () => {
  it("strips GPS and all other EXIF data", async () => {
    const original = await photoWithGps();
    const before = await sharp(Buffer.from(await original.arrayBuffer())).metadata();
    expect(before.exif).toBeDefined();

    const after = await sharp(await processImage(original, "post")).metadata();
    expect(after.format).toBe("webp");
    expect(after.exif).toBeUndefined();
    expect(after.xmp).toBeUndefined();
    expect(after.iptc).toBeUndefined();
  });

  it("crops avatars to a 512 square and caps post photos at 1600", async () => {
    const avatar = await sharp(await processImage(await photoWithGps(), "avatar")).metadata();
    expect([avatar.width, avatar.height]).toEqual([512, 512]);

    const big = await sharp({ create: { width: 4000, height: 2000, channels: 3, background: "#888" } }).png().toBuffer();
    const post = await sharp(await processImage(new File([new Uint8Array(big)], "big.png", { type: "image/png" }), "post")).metadata();
    expect([post.width, post.height]).toEqual([1600, 800]);
  });

  it("rejects the wrong type, a disguised file, and anything over 5 MB", async () => {
    const gif = new File([new Uint8Array([71, 73, 70, 56])], "a.gif", { type: "image/gif" });
    await expect(processImage(gif, "post")).rejects.toThrow(UploadError);

    const fake = new File([new TextEncoder().encode("not an image")], "fake.jpg", { type: "image/jpeg" });
    await expect(processImage(fake, "post")).rejects.toThrow("readable image");

    const huge = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "huge.jpg", { type: "image/jpeg" });
    await expect(processImage(huge, "post")).rejects.toThrow("5 MB");
  });
});
