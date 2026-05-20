import { exportLifDocument, importLifDocument } from "@agv/core";
import { downloadJson } from "../lib/download";
import {
  exportLif,
  saveMap as saveMapDocument,
} from "../services/api";
import { useEditorStore } from "../stores/editor-store";

export function useMapCommands() {
  const map = useEditorStore((state) => state.map);
  const setMapDocument = useEditorStore((state) => state.setMapDocument);

  return {
    saveMap: async () => {
      const saved = await saveMapDocument(map);
      setMapDocument(saved, `Saved ${saved.name}.`);
    },
    exportMap: async () => {
      const lif = await exportLif(map.id).catch(() => exportLifDocument(map));
      downloadJson(`${map.id}.lif.json`, lif);
    },
    importMap: async (file: File) => {
      const imported = importLifDocument(JSON.parse(await file.text()));
      setMapDocument(imported, `Imported ${imported.name}.`);
    },
  };
}
