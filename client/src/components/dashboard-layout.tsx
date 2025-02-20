"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ModeToggle } from "@/components/mode-toggle";
import { UserNav } from "@/components/user-nav";

type FileMap = Map<string, File | FileMap>;

export function FolderLayout() {
  const [fileMap, setFileMap] = useState<FileMap>(new Map());
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedContent, setSelectedContent] = useState<{
    url: string;
    name: string;
  } | null>(null);

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
    updateSelectedContent(path);
  };

  const updateSelectedContent = (path: string) => {
    if (!path) {
      setSelectedContent(null);
      return;
    }

    const pathParts = path.split("/");
    let current: FileMap | File = fileMap;

    for (const part of pathParts) {
      if (current instanceof Map && current.has(part)) {
        current = current.get(part) as FileMap | File;
      } else {
        setSelectedContent(null);
        return;
      }
    }

    if (current instanceof File) {
      setSelectedContent({
        url: URL.createObjectURL(current),
        name: pathParts[pathParts.length - 1],
      });
    } else {
      setSelectedContent(null);
    }
  };

  const sortEntries = (entries: [string, File | FileMap][]) => {
    return entries.sort((a, b) => {
      const aIsFolder = a[1] instanceof Map;
      const bIsFolder = b[1] instanceof Map;

      if (aIsFolder === bIsFolder) {
        return a[0].localeCompare(b[0]);
      }

      return aIsFolder ? -1 : 1;
    });
  };

  const displayFolders = (obj: FileMap, path = "", level = 0) => {
    const entries = Array.from(obj.entries());
    const sortedEntries = sortEntries(entries);

    return (
      <ul className={cn("space-y-0.5", level === 0 && "mt-2")}>
        {sortedEntries.map(([key, value]) => {
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
                  "flex items-center w-full text-left py-0.5 px-2 group rounded-sm",
                  isSelected
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-muted"
                )}
                style={{ paddingLeft: `${level * 12 + 8}px` }}
              >
                <ChevronRight
                  className={cn(
                    "w-4 h-4 shrink-0 mr-1 text-muted-foreground transition-transform",
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
                  <span className="text-sm">{key}</span>
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
      const entries = Array.from(current.entries());
      const sortedEntries = sortEntries(entries);

      return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
          {sortedEntries.map(([key, value]) => (
            <div key={key} className="text-center">
              {value instanceof Map ? (
                <div className="w-24 h-24 mx-auto flex items-center justify-center">
                  <FolderIcon
                    isFolder
                    isExpanded={false}
                    className="w-16 h-16"
                  />
                </div>
              ) : (
                <div className="relative w-24 h-24 mx-auto">
                  <img
                    src={URL.createObjectURL(value)}
                    alt={key}
                    className="w-full h-full object-cover rounded-lg cursor-pointer shadow-sm hover:shadow-lg transition"
                    onClick={() => setPreview(URL.createObjectURL(value))}
                  />
                </div>
              )}
              <p className="mt-2 text-sm truncate">{key}</p>
            </div>
          ))}
        </div>
      );
    } else if (current instanceof File) {
      return (
        <div className="text-center p-4">
          <img
            src={URL.createObjectURL(current)}
            alt={pathParts[pathParts.length - 1]}
            className="max-w-full max-h-[calc(100vh-12rem)] mx-auto rounded-lg shadow-lg"
          />
        </div>
      );
    }

    return null;
  };

  useEffect(() => {
    // Cleanup URLs when component unmounts or when selection changes
    return () => {
      if (preview) URL.revokeObjectURL(preview);
      if (selectedContent?.url) URL.revokeObjectURL(selectedContent.url);
    };
  }, [preview, selectedContent]);

  return (
    <SidebarProvider>
      <div className="flex w-full h-screen overflow-hidden">
        <Sidebar className="w-64 border-r">
          <SidebarHeader className="p-4">
            <Button asChild>
              <label className="cursor-pointer">
                Upload Folder
                <input
                  type="file"
                  ref={(input) => {
                    if (input) {
                      input.webkitdirectory = true;
                    }
                  }}
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
            </Button>
          </SidebarHeader>
          <SidebarContent>
            <ScrollArea className="h-[calc(100vh-8rem)]">
              <div className="px-3">
                <h2 className="text-sm font-medium p-2 border-b">Explorer</h2>
                <ScrollArea className="flex-1">
                  {displayFolders(fileMap)}
                </ScrollArea>
              </div>
            </ScrollArea>
          </SidebarContent>
          <SidebarFooter className="p-4">
            <Button variant="outline" className="w-full">
              Logout
            </Button>
          </SidebarFooter>
        </Sidebar>
        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="flex items-center justify-between px-6 py-4 border-b">
            <div className="flex items-center">
              <SidebarTrigger />
              <h1 className="text-2xl font-bold ml-4">Folder Viewer</h1>
            </div>
            <div className="flex items-center space-x-4">
              <ModeToggle />
              <UserNav />
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <div>
              <div className="">
                <h2 className="text-sm font-medium p-2 border-b pl-4">
                  {selectedPath || "Select a folder"}
                </h2>
                <ScrollArea className="flex-1">
                  {getSelectedContent()}
                </ScrollArea>
              </div>
              {preview && (
                <div
                  className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50"
                  onClick={() => setPreview(null)}
                >
                  <img
                    src={preview}
                    alt="Preview"
                    className="max-w-[90%] max-h-[90%] rounded-lg"
                  />
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
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
        className={cn("w-4 h-4 text-yellow-400", className)}
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

  const getIconColor = () => {
    switch (fileType?.toLowerCase()) {
      case "js":
      case "jsx":
        return "#F1E05A";
      case "ts":
      case "tsx":
        return "#3178C6";
      case "json":
        return "#F1E05A";
      case "md":
        return "#083fa1";
      case "css":
        return "#563d7c";
      case "html":
        return "#e34c26";
      default:
        return "currentColor";
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
