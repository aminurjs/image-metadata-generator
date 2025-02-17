"use client";

import { useState } from "react";
import axios from "axios";

export default function Home() {
  const [image, setImage] = useState<File | null>(null);
  const [newName, setNewName] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]); // Store multiple image URLs

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!image || !newName)
      return alert("Please select an image and enter a name");

    const formData = new FormData();
    formData.append("image", image);
    formData.append("newName", newName);

    try {
      const res = await axios.post("http://localhost:5000/upload", formData);
      setImageUrls((prev) => [res.data.imageUrl, ...prev]); // Add new image URL to list
    } catch (error) {
      console.error("Upload failed", error);
    }
  };

  return (
    <div className="p-4">
      <form onSubmit={handleUpload} className="flex flex-col gap-4">
        <input
          type="file"
          onChange={(e) => setImage(e.target.files?.[0] || null)}
          required
        />
        <input
          type="text"
          placeholder="New image name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          required
        />
        <button type="submit" className="bg-blue-500 text-white p-2 rounded">
          Upload & Rename
        </button>
      </form>

      {imageUrls.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-4">
          {imageUrls.map((url, index) => (
            <div key={index} className="border p-2">
              <p className="text-center text-sm">Image {index + 1}</p>
              <img
                src={url}
                alt={`Renamed ${index}`}
                className="w-full h-40 object-cover"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
