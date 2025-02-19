"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  ArrowUpTrayIcon,
  XMarkIcon,
  ClipboardIcon,
  PencilIcon,
  CheckIcon,
  ArrowDownTrayIcon,
  PhotoIcon,
} from "@heroicons/react/24/outline";
import {
  EditingState,
  MetadataResult,
  ProcessProgressData,
  ServerMetadataResponse,
} from "@/types";
import { countWords, downloadCSV, downloadImagesAsZip } from "@/actions";
import { io } from "socket.io-client";
import { Socket } from "socket.io-client";
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
  const [downloadInfo, setDownloadInfo] = useState<{
    id: string;
    downloadable: boolean;
  }>({
    id: "",
    downloadable: false,
  });

  // Add socket ref
  const socketRef = useRef<Socket | null>(null);

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

      const updateData: { [key: string]: string | string[] } = {};

      // Only include the field being edited
      if (editing.field === "keywords") {
        updateData[editing.field] = editValue
          .split(",")
          .map((k) => k.trim())
          .filter((k) => k);
      } else {
        updateData[editing.field] = editValue;
      }

      // Add check for imageUrl
      if (!result.imageUrl) return;

      const response = await fetch(`http://localhost:5000/api/images/update`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imagePath: result.imageUrl.replace("http://localhost:5000", ""),
          _id: result.id,
          updateData,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setResults((prev) =>
          prev.map((r) =>
            r.id === id
              ? {
                  ...r,
                  ...data.updatedFields,
                }
              : r
          )
        );
      }
    } catch (err) {
      console.error("Failed to save edit:", err);
    }
    setEditing({ id: null, field: null });
    setEditValue("");
  };

  // Remove the useEffect for socket initialization and move the socket setup to a new function
  const setupSocket = () => {
    const socket = io("http://localhost:5000", {
      transports: ["websocket"],
      autoConnect: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Connected to server");
    });

    socket.on("processStart", (data: { total: number }) => {
      console.log(`Starting to process ${data.total} images`);
      setProcessing(true);
    });

    socket.on("processProgress", (data: ProcessProgressData) => {
      console.log(`Processed ${data.completed}/${data.total} images`);

      setResults((prev) => {
        const updatedResult: MetadataResult = {
          id:
            data.currentResult._id ||
            data.currentResult.id ||
            crypto.randomUUID(),
          fileName: data.currentResult.filename,
          title: data.currentResult.metadata.title,
          description: data.currentResult.metadata.description,
          keywords: data.currentResult.metadata.keywords,
          status:
            data.currentResult.status === "progress"
              ? "processing"
              : "completed",
          imageUrl: `http://localhost:5000${data.currentResult.imageUrl}`,
        };

        const existingIndex = prev.findIndex(
          (r) => r.fileName === data.currentResult.filename
        );
        if (existingIndex >= 0) {
          return prev.map((r, i) => (i === existingIndex ? updatedResult : r));
        }
        return [...prev, updatedResult];
      });
    });

    socket.on("processError", (data: { error: string }) => {
      setError(data.error);
      setProcessing(false);
      socket.disconnect();
    });

    socket.on(
      "processComplete",
      (data: {
        status: string;
        results: {
          id: string;
          downloadable: boolean;
          data: Array<ServerMetadataResponse>;
        };
      }) => {
        console.log("Process Complete:", data);

        setResults((prev) => {
          const updatedResults = data.results.data.map((item) => ({
            id: item._id || crypto.randomUUID(),
            fileName: item.filename,
            title: item.metadata.title,
            description: item.metadata.description,
            keywords: item.metadata.keywords,
            status: "completed" as const,
            imageUrl: `http://localhost:5000${item.imageUrl}`,
          }));

          // Replace existing results with completed ones
          return prev.map((prevResult) => {
            const completedResult = updatedResults.find(
              (r) => r.fileName === prevResult.fileName
            );
            return completedResult || prevResult;
          });
        });

        setProcessing(false);
        setFiles([]);
        socket.disconnect();

        // Store download info
        setDownloadInfo({
          id: data.results.id,
          downloadable: data.results.downloadable,
        });
      }
    );

    socket.on("disconnect", () => {
      console.log("Disconnected from server");
      socketRef.current = null;
    });

    return socket;
  };

  // Update the processFiles function to handle socket connection
  const processFiles = async () => {
    setProcessing(true);
    setError(null);

    try {
      // Setup socket connection before processing
      if (!socketRef.current) {
        setupSocket();
      }

      const formData = new FormData();
      files.forEach((file) => {
        formData.append("images", file);
      });

      // Add initial results with processing status
      const initialResults: MetadataResult[] = files.map((file) => ({
        id: crypto.randomUUID(),
        fileName: file.name,
        title: "",
        description: "",
        keywords: [],
        status: "processing" as const,
        imageUrl: previews[file.name],
      }));

      setResults((prev) => [...prev, ...initialResults]);

      const response = await fetch("http://localhost:5000/api/process-images", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message);
      }

      console.log(`Started processing ${result.totalImages} images`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process files");
      setProcessing(false);
      // Disconnect socket on error
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    }
  };

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800">
            AI Metadata Generator
          </h1>
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
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-semibold text-gray-800">Results</h2>
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
                    onClick={() =>
                      downloadImagesAsZip(
                        downloadInfo.id,
                        downloadInfo.downloadable,
                        setIsDownloading
                      )
                    }
                    disabled={
                      isDownloading.csv ||
                      isDownloading.images ||
                      !downloadInfo.downloadable
                    }
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
            <div className="space-y-6">
              {results.map((result) => (
                <div key={result.id} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex gap-6">
                    {/* Image Preview */}
                    <div className="w-48 h-48 flex-shrink-0 relative">
                      <Image
                        src={`${result.imageUrl}` || previews[result.fileName]}
                        width={300}
                        height={300}
                        alt={result.fileName}
                        className="w-full h-full object-cover rounded-lg"
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

                    {/* Metadata Content */}
                    <div className="flex-1">
                      {/* Filename and Status */}
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="font-medium text-gray-700 ellipsis-clamp">
                          {result.fileName}
                        </h3>
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
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

                      {/* Title Section */}
                      <div className="mb-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium">Title:</span>
                          <span className="text-sm text-gray-500">
                            {result.title.length} | {countWords(result.title)}
                          </span>
                        </div>
                        {editing.id === result.id &&
                        editing.field === "title" ? (
                          <div className="flex items-center mt-1">
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="w-full p-2 border rounded-lg mr-2"
                            />
                            <button
                              onClick={() => saveEdit(result.id)}
                              className="text-green-600 hover:text-green-700"
                            >
                              <CheckIcon className="h-5 w-5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center">
                            <p className="flex-grow text-sm">{result.title}</p>
                            <div className="flex gap-2 ml-2">
                              <button
                                onClick={() =>
                                  startEditing(result.id, "title", result.title)
                                }
                                className="text-gray-400 hover:text-gray-600"
                              >
                                <PencilIcon className="h-4 w-4" />
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
                                  <CheckIcon className="h-4 w-4 text-green-600" />
                                ) : (
                                  <ClipboardIcon className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Description Section */}
                      <div className="mb-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium">Description:</span>
                          <span className="text-sm text-gray-500">
                            {result.description.length} |{" "}
                            {countWords(result.description)}
                          </span>
                        </div>
                        {editing.id === result.id &&
                        editing.field === "description" ? (
                          <div className="flex items-center mt-1">
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="w-full p-2 border rounded-lg mr-2"
                            />
                            <button
                              onClick={() => saveEdit(result.id)}
                              className="text-green-600 hover:text-green-700"
                            >
                              <CheckIcon className="h-5 w-5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center">
                            <p className="flex-grow text-sm">
                              {result.description}
                            </p>
                            <div className="flex gap-2 ml-2">
                              <button
                                onClick={() =>
                                  startEditing(
                                    result.id,
                                    "description",
                                    result.description
                                  )
                                }
                                className="text-gray-400 hover:text-gray-600"
                              >
                                <PencilIcon className="h-4 w-4" />
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
                                  <CheckIcon className="h-4 w-4 text-green-600" />
                                ) : (
                                  <ClipboardIcon className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Keywords Section */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium">Keywords:</span>
                          <div className="flex items-center gap-4">
                            <span className="text-sm text-gray-500">
                              {result.keywords.length} keywords
                            </span>
                            <div className="flex gap-2">
                              <button
                                onClick={() =>
                                  startEditing(
                                    result.id,
                                    "keywords",
                                    result.keywords
                                  )
                                }
                                className="text-gray-400 hover:text-gray-600"
                              >
                                <PencilIcon className="h-4 w-4" />
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
                                  <CheckIcon className="h-4 w-4 text-green-600" />
                                ) : (
                                  <ClipboardIcon className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                        {editing.id === result.id &&
                        editing.field === "keywords" ? (
                          <div className="flex items-center mt-1">
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="w-full p-2 border rounded-lg mr-2"
                              placeholder="Comma-separated keywords"
                            />
                            <button
                              onClick={() => saveEdit(result.id)}
                              className="text-green-600 hover:text-green-700"
                            >
                              <CheckIcon className="h-5 w-5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {result.keywords.map((keyword, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs"
                              >
                                {keyword}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
