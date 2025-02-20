"use client";

import type React from "react";
import { useState } from "react";
import Image from "next/image";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type FileMap = Map<string, File | FileMap>;

export default function FolderViewer() {
  const [fileMap, setFileMap] = useState<FileMap>(new Map());
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const allowedExtensions = ["jpg", "jpeg", "png", "gif", "webp", "svg"];
    const newFileMap: FileMap = new Map();

    Array.from(files).forEach((file) => {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!ext || !allowedExtensions.includes(ext)) return;

      const pathParts = file.webkitRelativePath.split("/");
      let current: FileMap = newFileMap;

      pathParts.forEach((part, i) => {
        if (i === pathParts.length - 1) {
          current.set(part, file);
        } else {
          if (!current.has(part)) current.set(part, new Map() as FileMap);
          current = current.get(part) as FileMap;
        }
      });
    });

    setFileMap(newFileMap);
  };

  const toggleExpand = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const selectItem = (path: string) => {
    setSelectedPath(path);
  };

  const displayFolders = (obj: FileMap, path = "", level = 0) => {
    return (
      <ul className={cn("space-y-0.5", level === 0 && "mt-2")}>
        {Array.from(obj.entries()).map(([key, value]) => {
          const isFolder = value instanceof Map;
          const isExpanded = expanded[path + key];
          const isSelected = selectedPath === path + key;
          const ext = key.split(".").pop();

          return (
            <li key={key} className="relative">
              <button
                onClick={() => {
                  if (isFolder) {
                    toggleExpand(path + key);
                  }
                  selectItem(path + key);
                }}
                className={cn(
                  "flex items-center w-full text-left py-0.5 px-2 group",
                  isSelected && "bg-[#37373d]",
                  !isSelected && "hover:bg-[#2a2d2e]"
                )}
                style={{ paddingLeft: `${level * 12 + 8}px` }}
              >
                <ChevronRight
                  className={cn(
                    "w-4 h-4 shrink-0 mr-1 text-[#6b6b6b] transition-transform",
                    isFolder ? "opacity-100" : "opacity-0",
                    isExpanded && "rotate-90"
                  )}
                />
                <div className="flex items-center gap-1.5">
                  <FolderIcon
                    isFolder={isFolder}
                    isExpanded={isExpanded}
                    fileType={ext}
                  />
                  <span className="text-sm text-[#CCCCCC]">{key}</span>
                </div>
              </button>
              {isFolder &&
                isExpanded &&
                displayFolders(value as FileMap, path + key + "/", level + 1)}
            </li>
          );
        })}
      </ul>
    );
  };

  const getSelectedContent = () => {
    if (!selectedPath) return null;

    const pathParts = selectedPath.split("/");
    let current: FileMap | File = fileMap;

    for (const part of pathParts) {
      if (current instanceof Map && current.has(part)) {
        current = current.get(part) as FileMap | File;
      } else {
        return null;
      }
    }

    if (current instanceof Map) {
      return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from(current.entries()).map(([key, value]) => (
            <div key={key} className="text-center">
              {value instanceof Map ? (
                <FolderIcon
                  isFolder
                  isExpanded={false}
                  className="w-16 h-16 mx-auto"
                />
              ) : (
                <Image
                  src={URL.createObjectURL(value) || "/placeholder.svg"}
                  alt={key}
                  width={96}
                  height={96}
                  className="w-24 h-24 object-cover rounded-lg cursor-pointer mx-auto shadow-sm hover:shadow-lg transition"
                  onClick={() => setPreview(URL.createObjectURL(value))}
                />
              )}
              <p className="mt-2 text-sm text-[#CCCCCC] truncate">{key}</p>
            </div>
          ))}
        </div>
      );
    } else if (current instanceof File) {
      return (
        <div className="text-center">
          <Image
            src={URL.createObjectURL(current) || "/placeholder.svg"}
            alt={pathParts[pathParts.length - 1]}
            width={800}
            height={600}
            className="max-w-full max-h-[calc(100vh-12rem)] mx-auto rounded-lg shadow-lg"
          />
        </div>
      );
    }

    return null;
  };

  return (
    <div className="p-6 w-full mx-auto bg-[#252526] min-h-screen">
      <input
        type="file"
        ref={(input) => {
          if (input) {
            input.webkitdirectory = true;
          }
        }}
        multiple
        onChange={handleFileSelect}
        className="mb-4 block w-full text-sm text-[#CCCCCC] border border-[#37373d] rounded-lg cursor-pointer bg-[#2d2d2d] focus:outline-none"
      />

      <div className="flex gap-6 ">
        <div className="w-1/3  p-2 rounded-lg shadow-md overflow-auto max-h-[calc(100vh-12rem)] h-full">
          <h2 className="text-sm font-medium text-[#CCCCCC] uppercase px-2">
            Explorer
          </h2>
          {displayFolders(fileMap)}
        </div>
        <div className="w-2/3 bg-[#1e1e1e] p-4 rounded-lg shadow-md overflow-auto max-h-[calc(100vh-12rem)] h-full">
          <h2 className="text-sm font-medium text-[#CCCCCC] mb-4">
            {selectedPath || "Select a folder"}
          </h2>
          {getSelectedContent()}
        </div>
      </div>

      {preview && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50"
          onClick={() => setPreview(null)}
        >
          <Image
            src={preview || "/placeholder.svg"}
            alt="Preview"
            width={1200}
            height={900}
            className="max-w-[90%] max-h-[90%]"
          />
        </div>
      )}
    </div>
  );
}

function FolderIcon({
  isFolder,
  isExpanded,
  fileType,
  className,
}: {
  isFolder: boolean;
  isExpanded: boolean;
  fileType?: string;
  className?: string;
}) {
  if (isFolder) {
    return (
      <svg
        viewBox="0 0 24 24"
        className={cn("w-4 h-4 text-[#dcb67a]", className)}
        fill="currentColor"
      >
        {isExpanded ? (
          <path d="M20 4H4C2.89543 4 2 4.89543 2 6V18C2 19.1046 2.89543 20 4 20H20C21.1046 20 22 19.1046 22 18V8C22 6.89543 21.1046 6 20 6H12L10 4H4C2.89543 4 2 4.89543 2 6H20V8L22 6V6C22 4.89543 21.1046 4 20 4Z" />
        ) : (
          <path d="M10 4H4C2.89543 4 2 4.89543 2 6V18C2 19.1046 2.89543 20 4 20H20C21.1046 20 22 19.1046 22 18V8C22 6.89543 21.1046 6 20 6H12L10 4Z" />
        )}
      </svg>
    );
  }

  // Return appropriate icon color based on file type
  const getIconColor = () => {
    switch (fileType?.toLowerCase()) {
      case "js":
      case "jsx":
        return "#F1E05A"; // Yellow
      case "ts":
      case "tsx":
        return "#3178C6"; // Blue
      case "json":
        return "#F1E05A"; // Yellow
      case "md":
        return "#083fa1"; // Blue
      case "css":
        return "#563d7c"; // Purple
      case "html":
        return "#e34c26"; // Orange
      default:
        return "#8f8f8f"; // Gray
    }
  };

  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("w-4 h-4", className)}
      fill={getIconColor()}
    >
      <path d="M13 9V3.5L18.5 9M6 2C4.89 2 4 2.89 4 4V20C4 21.11 4.89 22 6 22H18C19.11 22 20 21.11 20 20V8L14 2H6Z" />
    </svg>
  );
}
