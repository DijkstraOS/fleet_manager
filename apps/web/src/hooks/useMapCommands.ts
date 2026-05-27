import { exportLifDocument, importLifDocument } from "@agv/core";
import { readBackgroundImageFile } from "../lib/background-image";
import { downloadJson } from "../lib/download";
import {
  exportLif,
  saveMap as saveMapDocument,
} from "../services/api";
import { useEditorStore } from "../stores/editor-store";

export function useMapCommands() {
  const map = useEditorStore((state) => state.map);
  const setMapDocument = useEditorStore((state) => state.setMapDocument);
  const setStatus = useEditorStore((state) => state.setStatus);
  const attachBackgroundImage = useEditorStore((state) => state.attachBackgroundImage);

  return {
    saveMap: async () => {
      const saved = await saveMapDocument(map);
      setMapDocument(saved, `Saved ${saved.name}.`, { preserveBackground: true });
    },
    exportMap: async () => {
      const lif = await exportLif(map.id).catch(() => exportLifDocument(map));
      downloadJson(`${map.id}.lif.json`, lif);
    },
    importMap: async (file: File) => {
      try {
        const imported = importLifDocument(JSON.parse(await file.text()));
        setMapDocument(imported, `Imported ${imported.name}.`);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Import failed.");
      }
    },
    uploadBackground: async (file: File) => {
      try {
        attachBackgroundImage(await readBackgroundImageFile(file));
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Background image upload failed.");
      }
    },
  };
}
