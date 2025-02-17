import { MetadataResult } from "@/types";

export const downloadCSV = (results: MetadataResult[]) => {
  const headers = ["Filename", "Title", "Description", "Keywords"];
  const csvContent = results.map((result) => [
    result.fileName,
    result.title,
    result.description,
    result.keywords.join(", "),
  ]);

  const csvString = [
    headers.join(","),
    ...csvContent.map((row) =>
      row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", "metadata_export.csv");
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const countWords = (str: string) => {
  return str
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
};
