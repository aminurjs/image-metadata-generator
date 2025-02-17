"use client";

import { useState, useCallback, useEffect } from "react";
import {
  ArrowUpTrayIcon,
  XMarkIcon,
  ClipboardIcon,
  PencilIcon,
  CheckIcon,
  ArrowDownTrayIcon,
  PhotoIcon,
} from "@heroicons/react/24/outline";
import { EditingState, MetadataResult } from "@/types";
import { countWords, downloadCSV, downloadImagesAsZip } from "@/actions";
import Image from "next/image";

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<MetadataResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingState>({
    id: null,
    field: null,
  });
  const [editValue, setEditValue] = useState("");
  const [previews, setPreviews] = useState<{ [key: string]: string }>({});
  const [copyStatus, setCopyStatus] = useState<{ [key: string]: boolean }>({});
  const [isDownloading, setIsDownloading] = useState<{
    csv: boolean;
    images: boolean;
  }>({ csv: false, images: false });

  // Function to generate image previews
  const generatePreviews = useCallback((files: File[]) => {
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviews((prev) => ({
          ...prev,
          [file.name]: reader.result as string,
        }));
      };
      reader.readAsDataURL(file);
    });
  }, []);

  // Update previews when files change
  useEffect(() => {
    generatePreviews(files);
  }, [files, generatePreviews]);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files).filter((file) =>
      ["image/jpeg", "image/png", "image/webp"].includes(file.type)
    );
    setFiles((prev) => [...prev, ...droppedFiles]);
    setError(null);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).filter((file) =>
        ["image/jpeg", "image/png", "image/webp"].includes(file.type)
      );
      setFiles((prev) => [...prev, ...selectedFiles]);
      setError(null);
    }
  };

  const removeFile = (index: number) => {
    const fileToRemove = files[index];
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => {
      const newPreviews = { ...prev };
      delete newPreviews[fileToRemove.name];
      return newPreviews;
    });
  };

  const copyToClipboard = async (text: string, field: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus({ [id + field]: true });
      setTimeout(() => setCopyStatus({}), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const startEditing = (
    id: string,
    field: "title" | "description" | "keywords",
    value: string | string[]
  ) => {
    setEditing({ id, field });
    setEditValue(Array.isArray(value) ? value.join(", ") : value);
  };

  const saveEdit = async (id: string) => {
    try {
      const result = results.find((r) => r.id === id);
      if (!result || !editing.field) return;

      let updatedValue = editValue as string | string[];
      if (editing.field === "keywords") {
        updatedValue = editValue
          .split(",")
          .map((k) => k.trim())
          .filter((k) => k);
      }

      console.log(updatedValue);

      // const response = await fetch(`/api/generate/${id}`, {
      //   method: "PATCH",
      //   headers: {
      //     "Content-Type": "application/json",
      //   },
      //   body: JSON.stringify({
      //     [editing.field]: updatedValue,
      //   }),
      // });

      // if (response.ok) {
      //   setResults((prev) =>
      //     prev.map((r) =>
      //       r.id === id
      //         ? {
      //             ...r,
      //             [editing.field!]:
      //               editing.field === "keywords"
      //                 ? (updatedValue as string[])
      //                 : updatedValue,
      //           }
      //         : r
      //     )
      //   );
      // }
    } catch (err) {
      console.error("Failed to save edit:", err);
    }
    setEditing({ id: null, field: null });
    setEditValue("");
  };

  const checkStatus = async (id: string) => {
    try {
      const response = await fetch(`/api/generate?id=${id}`);
      if (!response.ok) return;

      const data = await response.json();
      setResults((prev) =>
        prev.map((result) =>
          result.id === id
            ? {
                ...result,
                status: data.status,
                title: data.title,
                description: data.description,
                keywords: JSON.parse(data.keywords),
                error: data.error,
              }
            : result
        )
      );

      return data.status;
    } catch (error) {
      console.error("Error checking status:", error);
    }
  };

  const processFiles = async () => {
    setProcessing(true);
    setError(null);

    try {
      for (const file of files) {
        // Add to results with processing status first
        const newResult: MetadataResult = {
          id: crypto.randomUUID(),
          fileName: file.name,
          title: "",
          description: "",
          keywords: [],
          status: "processing",
          imageUrl: previews[file.name],
        };

        setResults((prev) => [...prev, newResult]);

        const formData = new FormData();
        formData.append("image", file);

        try {
          const response = await fetch(
            "http://localhost:5000/api/process-image",
            {
              method: "POST",
              body: formData,
            }
          );

          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.error || `Failed to process ${file.name}`);
          }

          // Update results with success status and metadata
          setResults((prev) =>
            prev.map((item) =>
              item.id === newResult.id
                ? {
                    ...item,
                    title: result.data.metadata.title,
                    description: result.data.metadata.description,
                    keywords: result.data.metadata.keywords,
                    status: "completed",
                    imageUrl: result.data.imageUrl,
                  }
                : item
            )
          );
        } catch (err) {
          // Update results with failed status
          setResults((prev) =>
            prev.map((item) =>
              item.id === newResult.id
                ? {
                    ...item,
                    status: "failed",
                    error:
                      err instanceof Error ? err.message : "Processing failed",
                  }
                : item
            )
          );
        }
      }

      setFiles([]); // Clear files after processing
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process files");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800">
            AI Metadata Generator
          </h1>
          {results.length > 0 && (
            <div className="flex gap-4">
              <button
                onClick={() => downloadCSV(results, setIsDownloading)}
                disabled={isDownloading.csv || isDownloading.images}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isDownloading.csv ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2" />
                ) : (
                  <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
                )}
                Export CSV
              </button>
              <button
                onClick={() => downloadImagesAsZip(results, setIsDownloading)}
                disabled={isDownloading.csv || isDownloading.images}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isDownloading.images ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2" />
                ) : (
                  <PhotoIcon className="h-5 w-5 mr-2" />
                )}
                Download Images
              </button>
            </div>
          )}
        </div>

        {/* Upload Area */}
        <div
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 mb-8 text-center bg-white shadow-sm hover:border-primary transition-colors"
        >
          <ArrowUpTrayIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p className="text-lg mb-4 text-gray-600">
            Drag and drop your images here, or
          </p>
          <label className="bg-primary text-white px-6 py-2 rounded-lg cursor-pointer hover:bg-blue-600 transition-colors inline-block">
            Browse Files
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileSelect}
            />
          </label>
          <p className="mt-2 text-sm text-gray-500">
            Supported formats: JPEG, PNG, WebP
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
            {error}
          </div>
        )}

        {/* File List with Previews */}
        {files.length > 0 && (
          <div className="mb-8 bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">
              Selected Files
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center p-3 bg-gray-50 rounded-lg"
                >
                  <div className="w-20 h-20 mr-3 flex-shrink-0">
                    {previews[file.name] && (
                      <img
                        src={previews[file.name]}
                        alt={file.name}
                        className="w-full h-full object-cover rounded-lg"
                      />
                    )}
                  </div>
                  <div className="flex-grow">
                    <span className="text-gray-700 break-all">{file.name}</span>
                  </div>
                  <button
                    onClick={() => removeFile(index)}
                    className="text-gray-400 hover:text-red-500 transition-colors ml-2"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={processFiles}
              disabled={processing}
              className="mt-4 bg-primary text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed w-full"
            >
              {processing ? "Processing..." : "Generate Metadata"}
            </button>
          </div>
        )}

        {/* Results with Previews and Counters */}
        {results.length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">
              Results
            </h2>
            <div className="space-y-6">
              {results.map((result) => (
                <div key={result.id} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-start space-x-4">
                      <div className="relative w-24 h-24">
                        <Image
                          src={result.imageUrl || previews[result.fileName]}
                          alt={result.fileName}
                          fill
                          className="object-cover rounded-lg"
                        />
                        {result.status === "processing" && (
                          <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-4 border-white border-t-transparent"></div>
                          </div>
                        )}
                        {result.status === "failed" && (
                          <div className="absolute inset-0 bg-red-500 bg-opacity-50 rounded-lg flex items-center justify-center">
                            <XMarkIcon className="h-8 w-8 text-white" />
                          </div>
                        )}
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-800">
                          {result.fileName}
                        </h3>
                        <span
                          className={`inline-block px-2 py-1 rounded-full text-sm mt-2 ${
                            result.status === "completed"
                              ? "bg-green-100 text-green-700"
                              : result.status === "processing"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {result.status.charAt(0).toUpperCase() +
                            result.status.slice(1)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {result.error && (
                    <div className="mb-4 text-red-600 text-sm">
                      Error: {result.error}
                    </div>
                  )}

                  {result.status === "completed" && (
                    <div className="space-y-4">
                      {/* Title with Counter */}
                      <div className="flex items-start justify-between">
                        <div className="flex-grow">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">Title:</span>
                            <span className="text-sm text-gray-500">
                              {result.title.length}/90 chars |{" "}
                              {countWords(result.title)} words
                            </span>
                          </div>
                          {editing.id === result.id &&
                          editing.field === "title" ? (
                            <div className="flex items-center mt-1">
                              <div className="flex-grow">
                                <input
                                  type="text"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="w-full p-2 border rounded-lg mr-2"
                                  maxLength={90}
                                />
                                <div className="text-sm text-gray-500 mt-1">
                                  {editValue.length}/90 chars |{" "}
                                  {countWords(editValue)} words
                                </div>
                              </div>
                              <button
                                onClick={() => saveEdit(result.id)}
                                className="text-green-600 hover:text-green-700 ml-2"
                              >
                                <CheckIcon className="h-5 w-5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center mt-1">
                              <p className="flex-grow">{result.title}</p>
                              <button
                                onClick={() =>
                                  startEditing(result.id, "title", result.title)
                                }
                                className="text-gray-400 hover:text-gray-600 mx-2"
                              >
                                <PencilIcon className="h-5 w-5" />
                              </button>
                              <button
                                onClick={() =>
                                  copyToClipboard(
                                    result.title,
                                    "title",
                                    result.id
                                  )
                                }
                                className="text-gray-400 hover:text-gray-600"
                              >
                                {copyStatus[result.id + "title"] ? (
                                  <CheckIcon className="h-5 w-5 text-green-600" />
                                ) : (
                                  <ClipboardIcon className="h-5 w-5" />
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Description with Counter */}
                      <div className="flex items-start justify-between">
                        <div className="flex-grow">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">Description:</span>
                            <span className="text-sm text-gray-500">
                              {result.description.length}/90 chars |{" "}
                              {countWords(result.description)} words
                            </span>
                          </div>
                          {editing.id === result.id &&
                          editing.field === "description" ? (
                            <div className="flex items-start mt-1">
                              <div className="flex-grow">
                                <textarea
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="w-full p-2 border rounded-lg mr-2"
                                  rows={3}
                                  maxLength={90}
                                />
                                <div className="text-sm text-gray-500 mt-1">
                                  {editValue.length}/90 chars |{" "}
                                  {countWords(editValue)} words
                                </div>
                              </div>
                              <button
                                onClick={() => saveEdit(result.id)}
                                className="text-green-600 hover:text-green-700 ml-2"
                              >
                                <CheckIcon className="h-5 w-5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center mt-1">
                              <p className="flex-grow">{result.description}</p>
                              <button
                                onClick={() =>
                                  startEditing(
                                    result.id,
                                    "description",
                                    result.description
                                  )
                                }
                                className="text-gray-400 hover:text-gray-600 mx-2"
                              >
                                <PencilIcon className="h-5 w-5" />
                              </button>
                              <button
                                onClick={() =>
                                  copyToClipboard(
                                    result.description,
                                    "description",
                                    result.id
                                  )
                                }
                                className="text-gray-400 hover:text-gray-600"
                              >
                                {copyStatus[result.id + "description"] ? (
                                  <CheckIcon className="h-5 w-5 text-green-600" />
                                ) : (
                                  <ClipboardIcon className="h-5 w-5" />
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Keywords with Counter */}
                      <div>
                        <div className="flex justify-between items-center">
                          <span className="font-medium">Keywords:</span>
                          <div className="flex items-center space-x-4">
                            <span className="text-sm text-gray-500">
                              {result.keywords.length}/25 keywords
                            </span>
                            <div className="flex items-center">
                              <button
                                onClick={() =>
                                  startEditing(
                                    result.id,
                                    "keywords",
                                    result.keywords
                                  )
                                }
                                className="text-gray-400 hover:text-gray-600 mx-2"
                              >
                                <PencilIcon className="h-5 w-5" />
                              </button>
                              <button
                                onClick={() =>
                                  copyToClipboard(
                                    result.keywords.join(", "),
                                    "keywords",
                                    result.id
                                  )
                                }
                                className="text-gray-400 hover:text-gray-600"
                              >
                                {copyStatus[result.id + "keywords"] ? (
                                  <CheckIcon className="h-5 w-5 text-green-600" />
                                ) : (
                                  <ClipboardIcon className="h-5 w-5" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                        {editing.id === result.id &&
                        editing.field === "keywords" ? (
                          <div className="flex items-start mt-2">
                            <div className="flex-grow">
                              <textarea
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="w-full p-2 border rounded-lg mr-2"
                                rows={3}
                                placeholder="Enter keywords separated by commas"
                              />
                              <div className="text-sm text-gray-500 mt-1">
                                {
                                  editValue.split(",").filter((k) => k.trim())
                                    .length
                                }
                                /25 keywords
                              </div>
                            </div>
                            <button
                              onClick={() => saveEdit(result.id)}
                              className="text-green-600 hover:text-green-700 ml-2"
                            >
                              <CheckIcon className="h-5 w-5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {result.keywords?.map((keyword, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                              >
                                {keyword}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
