"use client";

import { useState } from "react";

export const useFileManager = (projectId: string) => {
  const [files, setFiles] = useState<Array<{
    name: string;
    type: 'image' | 'label';
    path: string;
    lastModified: Date;
  }>>([]);

  const uploadFiles = async (files: FileList) => {
    // 這裡應該實現實際上傳邏輯
    const newFiles = Array.from(files).map(file => ({
      name: file.name,
      type: file.type.startsWith('image/') ? 'image' : 'label',
      path: `/projects/${projectId}/${file.name}`,
      lastModified: new Date(file.lastModified)
    }));
    
    setFiles(prev => [...prev, ...newFiles]);
  };

  return { files, uploadFiles };
};