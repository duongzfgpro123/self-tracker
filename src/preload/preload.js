const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("appInfo", { name: "Self Tracker" });

// Each method invokes one fixed IPC channel; SQL, the database object and ipcRenderer stay hidden.
contextBridge.exposeInMainWorld("api", {
  db: {
    getSchemaVersion: () => ipcRenderer.invoke("db:schemaVersion"),
  },
  muscles: {
    list: () => ipcRenderer.invoke("muscles:list"),
  },
});
