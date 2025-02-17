import { MetadataResult } from "@/types";

type DownloadState = {
  csv: boolean;
  images: boolean;
};

type SetDownloadingState = React.Dispatch<React.SetStateAction<DownloadState>>;

export const downloadCSV = async (
  results: MetadataResult[],
  setDownloading: SetDownloadingState
) => {
  if (!results.length) return;

  setDownloading((prev) => ({ ...prev, csv: true }));

  try {
    const headers = [
      "File Name",
      "Title",
      "Description",
      "Keywords",
      "Image URL",
    ];
    const csvContent = [
      headers,
      ...results.map((result) => [
        result.fileName,
        result.title,
        result.description,
        result.keywords.join(", "),
        result.imageUrl || "",
      ]),
    ]
      .map((row) =>
        row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute(
      "download",
      `metadata_export_${new Date().toISOString()}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    setDownloading((prev) => ({ ...prev, csv: false }));
  }
};

export const downloadImagesAsZip = async (
  results: MetadataResult[],
  setDownloading: SetDownloadingState
) => {
  if (!results.length) return;

  setDownloading((prev) => ({ ...prev, images: true }));

  try {
    // Dynamically import JSZip only when needed
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();

    // Create a folder for the images
    const imgFolder = zip.folder("images");
    if (!imgFolder) return;

    // Download each image and add to zip
    const fetchPromises = results.map(async (result) => {
      if (!result.imageUrl) return;

      try {
        const response = await fetch(result.imageUrl);
        const blob = await response.blob();

        // Get file extension from URL or default to jpg
        const extension = result.imageUrl.split(".").pop() || "jpg";
        const sanitizedFileName = result.fileName.replace(/[^a-zA-Z0-9]/g, "_");

        imgFolder.file(`${sanitizedFileName}.${extension}`, blob);
      } catch (error) {
        console.error(`Failed to download ${result.fileName}:`, error);
      }
    });

    await Promise.all(fetchPromises);

    // Generate and download zip
    const content = await zip.generateAsync({ type: "blob" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(content);
    link.setAttribute("download", `images_${new Date().toISOString()}.zip`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    setDownloading((prev) => ({ ...prev, images: false }));
  }
};

export const countWords = (str: string) => {
  return str
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
};
