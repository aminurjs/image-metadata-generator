"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { ArrowDownTrayIcon, PhotoIcon } from "@heroicons/react/24/outline";
import {
  EditingState,
  MetadataResult,
  ProcessProgressData,
  ServerMetadataResponse,
} from "@/types";
import { downloadCSV, downloadImagesAsZip } from "@/actions";
import { io } from "socket.io-client";
import { Socket } from "socket.io-client";
import { FileUpload } from "@/components/FileUpload";
import { FileList } from "@/components/FileList";
import { MetadataEditor } from "@/components/MetadataEditor";
import { Toaster } from "react-hot-toast";

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
      formData.append("existingId", downloadInfo.id);
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
      <Toaster position="top-right" />
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-800 mb-8">
          AI Metadata Generator
        </h1>

        <FileUpload onDrop={onDrop} handleFileSelect={handleFileSelect} />

        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
            {error}
          </div>
        )}

        {files.length > 0 && (
          <FileList
            files={files}
            previews={previews}
            removeFile={removeFile}
            processFiles={processFiles}
            processing={processing}
          />
        )}

        {results.length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-semibold text-gray-800">Results</h2>
              <div className="flex gap-4">
                <button
                  onClick={() => downloadCSV(results, setIsDownloading)}
                  disabled={
                    isDownloading.csv || isDownloading.images || processing
                  }
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
                    !downloadInfo.downloadable ||
                    processing
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
            </div>
            <div className="space-y-6">
              {results.map((result) => (
                <MetadataEditor
                  key={result.id}
                  result={result}
                  editing={editing}
                  editValue={editValue}
                  setEditValue={setEditValue}
                  startEditing={startEditing}
                  saveEdit={saveEdit}
                  copyToClipboard={copyToClipboard}
                  copyStatus={copyStatus}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
